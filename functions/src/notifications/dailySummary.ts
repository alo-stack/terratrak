/**
 * Daily summary email
 * Sends a summary of the last 24 hours
 */

import * as admin from 'firebase-admin';
import { sendEmail } from '../email/emailService';
import { dailySummaryTemplate } from '../email/templates';

const DEVICE_ID = 'esp32-001';

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function min(arr: number[]): number {
  return arr.length ? Math.min(...arr) : 0;
}

function max(arr: number[]): number {
  return arr.length ? Math.max(...arr) : 0;
}

function getTrend(series: number[]): string {
  if (series.length < 2) return 'Stable';
  
  const first = avg(series.slice(0, Math.floor(series.length / 2)));
  const last = avg(series.slice(Math.floor(series.length / 2)));
  const change = ((last - first) / first) * 100;
  
  if (Math.abs(change) < 3) return 'Stable';
  if (change > 0) return `Rising (+${change.toFixed(1)}%)`;
  return `Falling (${change.toFixed(1)}%)`;
}

export async function sendDailySummary() {
  console.log('Generating daily summary...');
  
  try {
    const db = admin.firestore();
    
    // Get last 24 hours of data
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const readingsRef = db
      .collection('sensor_readings')
      .doc(DEVICE_ID)
      .collection('readings');
    
    const snapshot = await readingsRef
      .where('updatedAt', '>=', admin.firestore.Timestamp.fromDate(yesterday))
      .orderBy('updatedAt', 'asc')
      .get();
    
    if (snapshot.empty) {
      console.log('No data in last 24 hours');
      // Still send an email saying no data
      await sendEmail({
        subject: '📊 Daily Summary - No Data - TerraTak',
        html: `
          <p>No sensor data was received in the last 24 hours.</p>
          <p>Please check if your ESP32 is online and transmitting data.</p>
        `,
      });
      return;
    }
    
    // Collect all readings
    const tempSeries: number[] = [];
    const moistSeries: number[] = [];
    const nSeries: number[] = [];
    const pSeries: number[] = [];
    const kSeries: number[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const temp = Number(data.tempC ?? data.temperature);
      const moist = Number(data.moisturePct ?? data.moisture);
      const n = Number(data.npk?.n);
      const p = Number(data.npk?.p);
      const k = Number(data.npk?.k);
      
      if (Number.isFinite(temp)) tempSeries.push(temp);
      if (Number.isFinite(moist)) moistSeries.push(moist);
      if (Number.isFinite(n)) nSeries.push(n);
      if (Number.isFinite(p)) pSeries.push(p);
      if (Number.isFinite(k)) kSeries.push(k);
    });
    
    // Calculate summary statistics
    const tempAvg = avg(tempSeries);
    const tempMin = min(tempSeries);
    const tempMax = max(tempSeries);
    const tempTrend = getTrend(tempSeries);
    
    const moistAvg = avg(moistSeries);
    const moistMin = min(moistSeries);
    const moistMax = max(moistSeries);
    const moistTrend = getTrend(moistSeries);
    
    const nAvg = Math.round(avg(nSeries));
    const pAvg = Math.round(avg(pSeries));
    const kAvg = Math.round(avg(kSeries));
    
    // Check thresholds for alerts count
    const THRESHOLDS = {
      temp: { min: 15, max: 65 },
      moist: { min: 40, max: 80 },
      n: { min: 150, max: 900 },
      p: { min: 50, max: 300 },
      k: { min: 100, max: 800 },
    };
    
    let alertCount = 0;
    alertCount += tempSeries.filter(t => t < THRESHOLDS.temp.min || t > THRESHOLDS.temp.max).length;
    alertCount += moistSeries.filter(m => m < THRESHOLDS.moist.min || m > THRESHOLDS.moist.max).length;
    alertCount += nSeries.filter(n => n < THRESHOLDS.n.min || n > THRESHOLDS.n.max).length;
    alertCount += pSeries.filter(p => p < THRESHOLDS.p.min || p > THRESHOLDS.p.max).length;
    alertCount += kSeries.filter(k => k < THRESHOLDS.k.min || k > THRESHOLDS.k.max).length;
    
    // Determine overall status
    let status = 'Good';
    if (alertCount > 50) status = 'Critical';
    else if (alertCount > 10) status = 'Warning';
    
    // Generate insights
    const insights: string[] = [];
    
    if (tempAvg < THRESHOLDS.temp.min) {
      insights.push('Temperature was consistently low — consider adding insulation or fresh materials');
    } else if (tempAvg > THRESHOLDS.temp.max) {
      insights.push('Temperature ran high — improve ventilation or turn the pile');
    }
    
    if (moistAvg < THRESHOLDS.moist.min) {
      insights.push('Moisture was low — gradually add water and mix well');
    } else if (moistAvg > THRESHOLDS.moist.max) {
      insights.push('Moisture was high — add dry bedding and reduce watering');
    }
    
    if (tempTrend.includes('Rising') && tempAvg > 50) {
      insights.push('Temperature is rising steadily — monitor for overheating');
    }
    
    if (moistTrend.includes('Falling') && moistAvg < 50) {
      insights.push('Moisture is declining — check watering schedule');
    }
    
    // Send email
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    await sendEmail({
      subject: `📊 Daily Summary - ${status} - TerraTak`,
      html: dailySummaryTemplate({
        date: today,
        status,
        temperature: {
          avg: tempAvg,
          min: tempMin,
          max: tempMax,
          trend: tempTrend,
        },
        moisture: {
          avg: moistAvg,
          min: moistMin,
          max: moistMax,
          trend: moistTrend,
        },
        npk: { n: nAvg, p: pAvg, k: kAvg },
        alerts: alertCount,
        insights,
      }),
    });
    
    console.log('Daily summary sent successfully');
    
  } catch (error) {
    console.error('Error sending daily summary:', error);
    throw error;
  }
}
