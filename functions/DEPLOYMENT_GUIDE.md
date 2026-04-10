# Email Notifications Setup Guide

## 🚀 Quick Start (15 minutes)

This guide will help you set up email notifications for your TerraTrak dashboard.

---

## Step 1: Configure Gmail Credentials

You need to set your Gmail credentials as Firebase environment variables.

Open a terminal in the `functions` folder and run:

```bash
cd functions
firebase functions:config:set gmail.email="your-email@gmail.com"
firebase functions:config:set gmail.password="your-16-char-app-password"
firebase functions:config:set notification.recipient="email-to-receive-alerts@gmail.com"
```

**Replace with your actual values:**
- `gmail.email` - Your Gmail address
- `gmail.password` - The 16-character App Password you generated
- `notification.recipient` - Email address where you want to receive alerts (can be same as gmail.email)

---

## Step 2: Install Dependencies

In the `functions` folder, run:

```bash
npm install
```

This will install all required packages including TypeScript, Nodemailer, and Firebase Functions.

---

## Step 3: Build TypeScript

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

This creates a `lib` folder with compiled JavaScript files.

---

## Step 4: Deploy to Firebase

Deploy all three Cloud Functions:

```bash
npm run deploy
```

Or if you prefer to use Firebase CLI directly:

```bash
firebase deploy --only functions
```

**This will deploy:**
- ✅ `deviceStatusCheck` - Runs every 15 minutes
- ✅ `thresholdAlertCheck` - Triggers on new sensor readings
- ✅ `dailySummaryEmail` - Runs daily at 8:00 AM

---

## Step 5: Verify Deployment

After deployment completes, you should see output like:

```
✔  functions[deviceStatusCheck(us-central1)] Successful create operation.
✔  functions[thresholdAlertCheck(us-central1)] Successful create operation.
✔  functions[dailySummaryEmail(us-central1)] Successful create operation.
```

---

## 🧪 Testing

### Test Device Status Check Manually

```bash
firebase functions:shell
```

Then in the shell:
```javascript
deviceStatusCheck()
```

### View Logs

```bash
firebase functions:log
```

Or view logs in Firebase Console:
https://console.firebase.google.com/project/YOUR-PROJECT/functions/logs

---

## ⚙️ Configuration Options

### Change Timezone

Edit `functions/src/index.ts` and change:

```typescript
timeZone: 'Asia/Manila'
```

To your timezone (e.g., 'America/New_York', 'Europe/London')

### Change Daily Summary Time

Edit `functions/src/index.ts`:

```typescript
schedule: 'every day 08:00'  // Change to '07:00', '09:00', etc.
```

### Change Offline Threshold

Edit `functions/src/notifications/deviceStatus.ts`:

```typescript
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
```

### Adjust Thresholds

Edit `functions/src/notifications/thresholdAlerts.ts`:

```typescript
const DEFAULT_THRESHOLDS = {
  temperature: { min: 15, max: 65 },  // Change these
  moisture: { min: 40, max: 80 },
  npk: {
    n: { min: 150, max: 900 },
    p: { min: 50, max: 300 },
    k: { min: 100, max: 800 },
  },
};
```

### Change Alert Cooldown

Edit `functions/src/notifications/thresholdAlerts.ts`:

```typescript
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
```

---

## 📧 Email Types You'll Receive

### 1. Device Offline Alert 🔴
- **When:** ESP32 hasn't sent data for 30+ minutes
- **Subject:** "🔴 ESP32 Device Offline - TerraTrak"
- **Contains:** Last seen time, troubleshooting steps

### 2. Device Online Alert ✅
- **When:** ESP32 reconnects after being offline
- **Subject:** "✅ ESP32 Device Back Online - TerraTrak"
- **Contains:** Downtime duration

### 3. Threshold Alert ⚠️
- **When:** Temperature, moisture, or NPK goes out of range
- **Subject:** "⚠️ Threshold Alert - X Parameters Out of Range"
- **Cooldown:** Max 1 email per parameter per hour
- **Contains:** Which parameters, current values, recommended actions

### 4. Daily Summary 📊
- **When:** Every day at 8:00 AM
- **Subject:** "📊 Daily Summary - [Status] - TerraTrak"
- **Contains:** 24h averages, trends, alert count, insights

---

## 💰 Cost Breakdown (Staying Free)

### Firebase Blaze Plan Free Tier:
- **Cloud Functions:** 2,000,000 invocations/month
- **Your usage:** ~3,000/month (99.85% under limit)
  - Device check: 2,880/month (every 15 min)
  - Threshold checks: ~100/month (when ESP32 sends data)
  - Daily summaries: 30/month

### Gmail SMTP:
- **Limit:** 500 emails/day
- **Your usage:** ~10-15 emails/day
  - Daily summary: 1/day
  - Threshold alerts: 0-10/day (only when out of range)
  - Device status: 0-2/day (only when going offline/online)

**Total Cost: $0.00** ✅

---

## 🔧 Troubleshooting

### "Gmail credentials not configured" error

Run the config commands again:
```bash
firebase functions:config:set gmail.email="your-email@gmail.com"
firebase functions:config:set gmail.password="your-app-password"
```

### Not receiving emails

1. Check spam folder
2. Verify config is set:
```bash
firebase functions:config:get
```

3. Check function logs:
```bash
firebase functions:log
```

### "Invalid login" error from Gmail

- Make sure you're using an App Password (not your regular Gmail password)
- Verify 2FA is enabled on your Google account
- Regenerate App Password if needed

### Functions not triggering

- Check if functions are deployed:
```bash
firebase functions:list
```

- View function status in Firebase Console
- Check logs for errors

---

## 🎨 Customizing Email Templates

Email templates are in `functions/src/email/templates.ts`.

You can customize:
- Colors
- Text content
- Layout
- Add your logo
- Change dashboard URL

After editing, rebuild and redeploy:
```bash
npm run deploy
```

---

## 🔄 Updating Functions

When you make changes to the code:

```bash
cd functions
npm run build
npm run deploy
```

Or to test locally first:

```bash
npm run serve
```

---

## 📚 Additional Resources

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)

---

## ✅ Success Checklist

- [ ] Gmail App Password generated
- [ ] Firebase environment variables set
- [ ] Dependencies installed (`npm install`)
- [ ] TypeScript compiled (`npm run build`)
- [ ] Functions deployed (`npm run deploy`)
- [ ] Test email received
- [ ] Checked function logs

---

## 🆘 Need Help?

If you encounter issues:
1. Check the Firebase Console logs
2. Run `firebase functions:log` in terminal
3. Verify all environment variables are set correctly
4. Make sure ESP32 is sending data to Firestore

---

**You're all set! 🎉**

Your dashboard will now send you:
- Real-time alerts when conditions go out of range
- Notifications when your device goes offline
- Daily summaries every morning at 8 AM
