/**
 * HTML email templates
 */

export function deviceOfflineTemplate(lastSeen: string, downMinutes: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .icon { font-size: 48px; margin-bottom: 10px; }
    .content { padding: 30px 20px; }
    .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .info-grid { display: grid; gap: 10px; margin: 20px 0; }
    .info-item { background: #f9fafb; padding: 12px; border-radius: 6px; }
    .info-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .info-value { font-size: 16px; font-weight: 600; color: #111827; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
    .troubleshooting { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .troubleshooting h3 { margin-top: 0; color: #1e40af; font-size: 16px; }
    .troubleshooting ul { margin: 10px 0; padding-left: 20px; }
    .troubleshooting li { margin: 5px 0; color: #1e3a8a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔴</div>
      <h1>ESP32 Device Offline</h1>
      <p>Your vermicomposting sensor has stopped transmitting data</p>
    </div>
    
    <div class="content">
      <div class="alert-box">
        <strong>⚠️ Alert:</strong> No data received for ${downMinutes} minutes
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Last Seen</div>
          <div class="info-value">${lastSeen}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Downtime</div>
          <div class="info-value">${downMinutes} minutes</div>
        </div>
      </div>
      
      <div class="troubleshooting">
        <h3>Troubleshooting Steps:</h3>
        <ul>
          <li>Check if ESP32 power supply is connected</li>
          <li>Verify WiFi connection is stable</li>
          <li>Check Firebase credentials in ESP32 code</li>
          <li>Look for red LED error indicators on the device</li>
          <li>Try power cycling the ESP32</li>
        </ul>
      </div>
      
      <a href="https://terratrak.vercel.app/" class="button">Check Dashboard</a>
    </div>
    
    <div class="footer">
      <p>TerraTrak Vermicomposting Dashboard</p>
      <p>You're receiving this because device monitoring is enabled</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function deviceOnlineTemplate(downMinutes: number): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .icon { font-size: 48px; margin-bottom: 10px; }
    .content { padding: 30px 20px; }
    .success-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">✅</div>
      <h1>Device Back Online</h1>
      <p>Your ESP32 has reconnected successfully</p>
    </div>
    
    <div class="content">
      <div class="success-box">
        <strong>✓ Resolved:</strong> Device was offline for ${downMinutes} minutes and is now transmitting data again.
      </div>
      
      <p>Your vermicomposting monitoring has resumed. All systems are operational.</p>
      
      <a href="https://terratrak.vercel.app/" class="button">View Dashboard</a>
    </div>
    
    <div class="footer">
      <p>TerraTrak Vermicomposting Dashboard</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function thresholdAlertTemplate(alerts: Array<{parameter: string; value: number; threshold: string; status: string}>): string {
  const alertRows = alerts.map(alert => `
    <div class="alert-item">
      <div class="alert-header">
        <span class="alert-icon">${alert.status === 'high' ? '↑' : '↓'}</span>
        <strong>${alert.parameter}</strong>
      </div>
      <div class="alert-details">
        <span>Current: <strong>${alert.value}</strong></span>
        <span>•</span>
        <span>Threshold: ${alert.threshold}</span>
      </div>
    </div>
  `).join('');

  const actions = alerts.map(alert => {
    if (alert.parameter === 'Temperature') {
      return alert.status === 'high' 
        ? '<li>🌡️ <strong>Temperature too high:</strong> Improve ventilation or turn the pile</li>'
        : '<li>🌡️ <strong>Temperature too low:</strong> Check insulation or add fresh food scraps</li>';
    } else if (alert.parameter === 'Moisture') {
      return alert.status === 'high'
        ? '<li>💧 <strong>Moisture too high:</strong> Add dry bedding and reduce watering</li>'
        : '<li>💧 <strong>Moisture too low:</strong> Add water gradually and mix well</li>';
    } else {
      return `<li>🌿 <strong>${alert.parameter} out of range:</strong> Review feeding and bedding balance</li>`;
    }
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .icon { font-size: 48px; margin-bottom: 10px; }
    .content { padding: 30px 20px; }
    .alert-item { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .alert-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 16px; }
    .alert-icon { font-size: 20px; }
    .alert-details { font-size: 14px; color: #78716c; display: flex; gap: 10px; }
    .actions { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .actions h3 { margin-top: 0; color: #1e40af; font-size: 16px; }
    .actions ul { margin: 10px 0; padding-left: 20px; }
    .actions li { margin: 8px 0; color: #1e3a8a; line-height: 1.6; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">⚠️</div>
      <h1>Threshold Alert</h1>
      <p>One or more parameters are out of range</p>
    </div>
    
    <div class="content">
      ${alertRows}
      
      <div class="actions">
        <h3>💡 Recommended Actions:</h3>
        <ul>
          ${actions}
        </ul>
      </div>
      
      <a href="https://terratrak.vercel.app/" class="button">View Live Data</a>
    </div>
    
    <div class="footer">
      <p>TerraTrak Vermicomposting Dashboard</p>
      <p>You're receiving this because threshold monitoring is enabled</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function dailySummaryTemplate(summary: {
  date: string;
  status: string;
  temperature: { avg: number; min: number; max: number; trend: string };
  moisture: { avg: number; min: number; max: number; trend: string };
  npk: { n: number; p: number; k: number };
  alerts: number;
  insights: string[];
}): string {
  const statusColor = summary.status === 'Good' ? '#10b981' : summary.status === 'Warning' ? '#f59e0b' : '#ef4444';
  const statusIcon = summary.status === 'Good' ? '✓' : '⚠';

  const insightsList = summary.insights.map(insight => `<li>${insight}</li>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .icon { font-size: 48px; margin-bottom: 10px; }
    .content { padding: 30px 20px; }
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin: 10px 0; }
    .metrics { display: grid; gap: 15px; margin: 20px 0; }
    .metric-card { background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid; }
    .metric-card.temp { border-color: #10b981; }
    .metric-card.moisture { border-color: #38bdf8; }
    .metric-card.npk { border-color: #8b5cf6; }
    .metric-title { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
    .metric-value { font-size: 24px; font-weight: 700; color: #111827; }
    .metric-range { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    .metric-trend { display: inline-block; font-size: 12px; padding: 2px 8px; background: #e5e7eb; border-radius: 4px; margin-top: 4px; }
    .insights { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .insights h3 { margin-top: 0; color: #1e40af; font-size: 16px; }
    .insights ul { margin: 10px 0; padding-left: 20px; }
    .insights li { margin: 8px 0; color: #1e3a8a; line-height: 1.6; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
    .npk-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 10px; }
    .npk-item { text-align: center; }
    .npk-label { font-size: 11px; color: #6b7280; }
    .npk-value { font-size: 18px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">📊</div>
      <h1>Daily Summary</h1>
      <p>${summary.date}</p>
    </div>
    
    <div class="content">
      <div style="text-align: center;">
        <span class="status-badge" style="background: ${statusColor}22; color: ${statusColor}; border: 2px solid ${statusColor};">
          ${statusIcon} ${summary.status}
        </span>
        <p style="color: #6b7280; font-size: 14px;">${summary.alerts} alert${summary.alerts !== 1 ? 's' : ''} in the last 24 hours</p>
      </div>
      
      <div class="metrics">
        <div class="metric-card temp">
          <div class="metric-title">🌡️ Temperature</div>
          <div class="metric-value">${summary.temperature.avg.toFixed(1)}°C</div>
          <div class="metric-range">Min: ${summary.temperature.min.toFixed(1)}°C • Max: ${summary.temperature.max.toFixed(1)}°C</div>
          <div class="metric-trend">${summary.temperature.trend}</div>
        </div>
        
        <div class="metric-card moisture">
          <div class="metric-title">💧 Moisture</div>
          <div class="metric-value">${summary.moisture.avg.toFixed(1)}%</div>
          <div class="metric-range">Min: ${summary.moisture.min.toFixed(1)}% • Max: ${summary.moisture.max.toFixed(1)}%</div>
          <div class="metric-trend">${summary.moisture.trend}</div>
        </div>
        
        <div class="metric-card npk">
          <div class="metric-title">🌿 Nutrients (NPK)</div>
          <div class="npk-grid">
            <div class="npk-item">
              <div class="npk-label">N</div>
              <div class="npk-value">${summary.npk.n}</div>
            </div>
            <div class="npk-item">
              <div class="npk-label">P</div>
              <div class="npk-value">${summary.npk.p}</div>
            </div>
            <div class="npk-item">
              <div class="npk-label">K</div>
              <div class="npk-value">${summary.npk.k}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="insights">
        <h3>💡 Key Insights:</h3>
        <ul>
          ${insightsList || '<li>All conditions are within normal range. Keep up the good work!</li>'}
        </ul>
      </div>
      
      <a href="https://terratrak.vercel.app/" class="button">View Full Dashboard</a>
    </div>
    
    <div class="footer">
      <p>TerraTrak Vermicomposting Dashboard</p>
      <p>Daily summary • Delivered every morning at 8:00 AM</p>
    </div>
  </div>
</body>
</html>
  `;
}
