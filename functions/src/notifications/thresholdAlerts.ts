/**
 * Threshold alert monitoring
 * Checks if sensor readings are outside safe ranges
 */

import * as admin from 'firebase-admin';
import { sendEmail } from '../email/emailService';
import { thresholdAlertTemplate } from '../email/templates';

// Default thresholds (will be overridden by user settings if available)
const DEFAULT_THRESHOLDS = {
  temperature: { min: 15, max: 65 },
  moisture: { min: 40, max: 80 },
  npk: {
    n: { min: 150, max: 900 },
    p: { min: 50, max: 300 },
    k: { min: 100, max: 800 },
  },
};

// Don't send alerts more than once per hour per parameter
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

interface AlertLog {
  parameter: string;
  lastAlertSent: admin.firestore.Timestamp;
}

type Thresholds = typeof DEFAULT_THRESHOLDS;

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Get thresholds for a specific user by email
 */
async function getUserThresholds(db: admin.firestore.Firestore, email: string): Promise<Thresholds> {
  try {
    const thresholdSnap = await db.collection('user_accounts').doc(email.toLowerCase()).collection('thresholds').doc('config').get();
    
    if (!thresholdSnap.exists) {
      console.log(`No thresholds found for user ${email}, using defaults`);
      return DEFAULT_THRESHOLDS;
    }
    
    const data = thresholdSnap.data() as any;
    const t = data || {};
    
    const merged: Thresholds = {
      temperature: {
        min: toFiniteNumber(t?.temperature?.min) ?? DEFAULT_THRESHOLDS.temperature.min,
        max: toFiniteNumber(t?.temperature?.max) ?? DEFAULT_THRESHOLDS.temperature.max,
      },
      moisture: {
        min: toFiniteNumber(t?.moisture?.min) ?? DEFAULT_THRESHOLDS.moisture.min,
        max: toFiniteNumber(t?.moisture?.max) ?? DEFAULT_THRESHOLDS.moisture.max,
      },
      npk: {
        n: {
          min: toFiniteNumber(t?.n?.min) ?? DEFAULT_THRESHOLDS.npk.n.min,
          max: toFiniteNumber(t?.n?.max) ?? DEFAULT_THRESHOLDS.npk.n.max,
        },
        p: {
          min: toFiniteNumber(t?.p?.min) ?? DEFAULT_THRESHOLDS.npk.p.min,
          max: toFiniteNumber(t?.p?.max) ?? DEFAULT_THRESHOLDS.npk.p.max,
        },
        k: {
          min: toFiniteNumber(t?.k?.min) ?? DEFAULT_THRESHOLDS.npk.k.min,
          max: toFiniteNumber(t?.k?.max) ?? DEFAULT_THRESHOLDS.npk.k.max,
        },
      },
    };
    
    return merged;
  } catch (error) {
    console.warn(`Failed to load thresholds for ${email}, using defaults`, error);
    return DEFAULT_THRESHOLDS;
  }
}


/**
 * Get list of alert recipients
 */
async function getRecipientEmails(db: admin.firestore.Firestore): Promise<string[]> {
  try {
    const snap = await db.collection('email_addresses').doc('recipients').get();
    const emails = snap.exists ? snap.get('emails') : [];
    
    if (Array.isArray(emails)) {
      const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
      return emails
        .map((e: any) => String(e).trim().toLowerCase())
        .filter((e: any) => isValidEmail(e));
    }
    return [];
  } catch (error) {
    console.warn('Failed to load recipient emails', error);
    return [];
  }
}

export async function checkThresholdAlerts(sensorData: any) {
  console.log('Checking thresholds...');
  
  try {
    const db = admin.firestore();
    
    // Parse sensor data
    const temperature = Number(sensorData.tempC ?? sensorData.temperature);
    const moisture = Number(sensorData.moisturePct ?? sensorData.moisture);
    const n = Number(sensorData.npk?.n);
    const p = Number(sensorData.npk?.p);
    const k = Number(sensorData.npk?.k);
    
    // Validate all values are present
    if (![temperature, moisture, n, p, k].every(v => Number.isFinite(v))) {
      console.log('Invalid sensor data, skipping threshold check');
      return;
    }
    
    // Get recipients
    const recipients = await getRecipientEmails(db);
    if (recipients.length === 0) {
      console.log('No recipients configured');
      return;
    }
    
    // Check thresholds for each recipient
    for (const email of recipients) {
      // Get user's personal thresholds
      const thresholds = await getUserThresholds(db, email);
      
      // Check each parameter
      const alerts: Array<{
        parameter: string;
        value: number;
        threshold: string;
        status: 'high' | 'low';
      }> = [];
      
      // Temperature
      if (temperature < thresholds.temperature.min) {
        alerts.push({
          parameter: 'Temperature',
          value: Number(temperature.toFixed(1)),
          threshold: `${thresholds.temperature.min}°C - ${thresholds.temperature.max}°C`,
          status: 'low',
        });
      } else if (temperature > thresholds.temperature.max) {
        alerts.push({
          parameter: 'Temperature',
          value: Number(temperature.toFixed(1)),
          threshold: `${thresholds.temperature.min}°C - ${thresholds.temperature.max}°C`,
          status: 'high',
        });
      }
      
      // Moisture
      if (moisture < thresholds.moisture.min) {
        alerts.push({
          parameter: 'Moisture',
          value: Number(moisture.toFixed(1)),
          threshold: `${thresholds.moisture.min}% - ${thresholds.moisture.max}%`,
          status: 'low',
        });
      } else if (moisture > thresholds.moisture.max) {
        alerts.push({
          parameter: 'Moisture',
          value: Number(moisture.toFixed(1)),
          threshold: `${thresholds.moisture.min}% - ${thresholds.moisture.max}%`,
          status: 'high',
        });
      }
      
      // Real-time threshold alerts intentionally exclude N/P/K.
      // NPK conditions are reviewed in scheduled summary emails.
      
      if (alerts.length === 0) {
        console.log(`All parameters within range for ${email}`);
        continue;
      }
      
      // Check cooldown for each alert (per email)
      const now = admin.firestore.Timestamp.now();
      const alertsToSend: typeof alerts = [];
      
      for (const alert of alerts) {
        const logRef = db.collection('alert_log').doc(`threshold_${email.replace(/[^a-z0-9]/gi, '_')}_${alert.parameter.toLowerCase().replace(/\s+/g, '_')}`);
        const logDoc = await logRef.get();
        
        if (logDoc.exists) {
          const logData = logDoc.data() as AlertLog;
          const timeSinceLastAlert = now.toMillis() - logData.lastAlertSent.toMillis();
          
          if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
            console.log(`Skipping ${alert.parameter} alert for ${email} (cooldown active)`);
            continue;
          }
        }
        
        alertsToSend.push(alert);
        
        // Update alert log
        await logRef.set({
          parameter: alert.parameter,
          lastAlertSent: now,
        });
      }
      
      if (alertsToSend.length === 0) {
        console.log(`All alerts in cooldown for ${email}`);
        continue;
      }
      
      // Send email with all alerts for this user
      await sendEmail({
        recipient: email,
        subject: `⚠️ Threshold Alert - ${alertsToSend.length} Parameter${alertsToSend.length > 1 ? 's' : ''} Out of Range`,
        html: thresholdAlertTemplate(alertsToSend),
      });
      
      console.log(`Sent alert for ${email}: ${alertsToSend.map(a => a.parameter).join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error checking thresholds:', error);
    throw error;
  }
}
