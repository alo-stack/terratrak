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
    
    // Get user thresholds from localStorage (stored in Firestore by dashboard)
    // For now, use defaults. In production, you'd fetch from a user_settings collection
    const thresholds = DEFAULT_THRESHOLDS;
    
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
    
    // Nitrogen
    if (n < thresholds.npk.n.min || n > thresholds.npk.n.max) {
      alerts.push({
        parameter: 'Nitrogen (N)',
        value: Math.round(n),
        threshold: `${thresholds.npk.n.min}-${thresholds.npk.n.max} ppm`,
        status: n < thresholds.npk.n.min ? 'low' : 'high',
      });
    }
    
    // Phosphorus
    if (p < thresholds.npk.p.min || p > thresholds.npk.p.max) {
      alerts.push({
        parameter: 'Phosphorus (P)',
        value: Math.round(p),
        threshold: `${thresholds.npk.p.min}-${thresholds.npk.p.max} ppm`,
        status: p < thresholds.npk.p.min ? 'low' : 'high',
      });
    }
    
    // Potassium
    if (k < thresholds.npk.k.min || k > thresholds.npk.k.max) {
      alerts.push({
        parameter: 'Potassium (K)',
        value: Math.round(k),
        threshold: `${thresholds.npk.k.min}-${thresholds.npk.k.max} ppm`,
        status: k < thresholds.npk.k.min ? 'low' : 'high',
      });
    }
    
    if (alerts.length === 0) {
      console.log('All parameters within range');
      return;
    }
    
    // Check cooldown for each alert
    const now = admin.firestore.Timestamp.now();
    const alertsToSend: typeof alerts = [];
    
    for (const alert of alerts) {
      const logRef = db.collection('alert_log').doc(`threshold_${alert.parameter.toLowerCase().replace(/\s+/g, '_')}`);
      const logDoc = await logRef.get();
      
      if (logDoc.exists) {
        const logData = logDoc.data() as AlertLog;
        const timeSinceLastAlert = now.toMillis() - logData.lastAlertSent.toMillis();
        
        if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
          console.log(`Skipping ${alert.parameter} alert (cooldown active)`);
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
      console.log('All alerts in cooldown period');
      return;
    }
    
    // Send email with all alerts
    await sendEmail({
      subject: `⚠️ Threshold Alert - ${alertsToSend.length} Parameter${alertsToSend.length > 1 ? 's' : ''} Out of Range`,
      html: thresholdAlertTemplate(alertsToSend),
    });
    
    console.log(`Sent alert for: ${alertsToSend.map(a => a.parameter).join(', ')}`);
    
  } catch (error) {
    console.error('Error checking thresholds:', error);
    throw error;
  }
}
