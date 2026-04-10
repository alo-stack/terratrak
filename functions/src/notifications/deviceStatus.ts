/**
 * Device status monitoring
 * Checks if ESP32 has stopped transmitting data
 */

import * as admin from 'firebase-admin';
import { sendEmail } from '../email/emailService';
import { deviceOfflineTemplate, deviceOnlineTemplate } from '../email/templates';

const DEVICE_ID = 'esp32-001';
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

interface DeviceStatusDoc {
  isOffline: boolean;
  lastAlertSent: admin.firestore.Timestamp | null;
  offlineSince: admin.firestore.Timestamp | null;
}

export async function checkDeviceStatus() {
  console.log('Checking device status...');
  
  try {
    const db = admin.firestore();
    
    // Get latest sensor reading
    const latestDoc = await db.collection('sensor_readings').doc('latest').get();
    
    if (!latestDoc.exists) {
      console.log('No sensor readings found');
      return;
    }
    
    const latestData = latestDoc.data();
    const lastUpdate = latestData?.updatedAt || latestData?.timestamp;
    
    if (!lastUpdate) {
      console.log('No timestamp in sensor reading');
      return;
    }
    
    const now = admin.firestore.Timestamp.now();
    const lastUpdateMs = lastUpdate.toMillis();
    const nowMs = now.toMillis();
    const timeSinceLastUpdate = nowMs - lastUpdateMs;
    
    // Get or create device status tracking doc
    const statusRef = db.collection('device_status').doc(DEVICE_ID);
    const statusDoc = await statusRef.get();
    const statusData = (statusDoc.exists ? statusDoc.data() : {
      isOffline: false,
      lastAlertSent: null,
      offlineSince: null,
    }) as DeviceStatusDoc;
    
    const isCurrentlyOffline = timeSinceLastUpdate > OFFLINE_THRESHOLD_MS;
    
    // Device went offline
    if (isCurrentlyOffline && !statusData.isOffline) {
      console.log(`Device went offline. Last seen: ${lastUpdate.toDate()}`);
      
      const downMinutes = Math.round(timeSinceLastUpdate / (60 * 1000));
      
      // Send offline alert
      await sendEmail({
        subject: '🔴 ESP32 Device Offline - TerraTrak',
        html: deviceOfflineTemplate(
          lastUpdate.toDate().toLocaleString(),
          downMinutes
        ),
      });
      
      // Update status
      await statusRef.set({
        isOffline: true,
        lastAlertSent: now,
        offlineSince: lastUpdate,
      });
      
      console.log('Offline alert sent');
    }
    // Device came back online
    else if (!isCurrentlyOffline && statusData.isOffline) {
      console.log('Device came back online');
      
      const offlineSince = statusData.offlineSince || lastUpdate;
      const downMinutes = Math.round((nowMs - offlineSince.toMillis()) / (60 * 1000));
      
      // Send online alert
      await sendEmail({
        subject: '✅ ESP32 Device Back Online - TerraTrak',
        html: deviceOnlineTemplate(downMinutes),
      });
      
      // Update status
      await statusRef.set({
        isOffline: false,
        lastAlertSent: now,
        offlineSince: null,
      });
      
      console.log('Online alert sent');
    }
    // Device is online (no alert needed)
    else if (!isCurrentlyOffline) {
      console.log('Device is online. No alert needed.');
    }
    // Device is still offline (already alerted)
    else {
      console.log('Device is still offline. Alert already sent.');
    }
    
  } catch (error) {
    console.error('Error checking device status:', error);
    throw error;
  }
}
