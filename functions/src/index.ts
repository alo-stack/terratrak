/**
 * Cloud Functions for TerraTak Vermicomposting Dashboard
 * Email notifications for device status, thresholds, and daily summaries
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { checkDeviceStatus } from './notifications/deviceStatus';
import { checkThresholdAlerts } from './notifications/thresholdAlerts';
import { sendDailySummary } from './notifications/dailySummary';
import { sendEmail } from './email/emailService';

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Scheduled function: Check if ESP32 is offline
 * Runs every 15 minutes
 */
export const deviceStatusCheck = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Manila', // Change to your timezone
    memory: '256MiB',
  },
  async (event) => {
    await checkDeviceStatus();
  }
);

/**
 * Firestore trigger: Check thresholds when new sensor reading arrives
 * Triggers on any write to sensor_readings/latest
 */
export const thresholdAlertCheck = onDocumentWritten(
  {
    document: 'sensor_readings/latest',
    memory: '256MiB',
  },
  async (event) => {
    const newData = event.data?.after.data();
    if (!newData) return;
    
    await checkThresholdAlerts(newData);
  }
);

/**
 * Scheduled function: Send daily summary email
 * Runs every day at 6:00 AM and 6:00 PM
 */
export const dailySummaryEmail = onSchedule(
  {
    schedule: '0 6,18 * * *',
    timeZone: 'Asia/Manila', // Change to your timezone
    memory: '512MiB',
  },
  async (event) => {
    await sendDailySummary();
  }
);

/**
 * HTTP function: Send a test email immediately
 */
export const testEmail = onRequest(
  {
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      await sendEmail({
        subject: 'TerraTak Test Email',
        html: '<h2>TerraTak Test Email</h2><p>If you received this, email sending works.</p>',
      });
      res.status(200).send('Test email sent.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).send(`Failed to send test email: ${message}`);
    }
  }
);
