# 📧 Email Notifications - Quick Reference

## Setup Commands (One-time)

```bash
cd functions

# 1. Set credentials
firebase functions:config:set gmail.email="your@gmail.com"
firebase functions:config:set gmail.password="your-app-password"
firebase functions:config:set notification.recipient="alerts@email.com"

# 2. Install & deploy
npm install
npm run build
npm run deploy
```

## Daily Commands

```bash
# View logs
firebase functions:log

# Check what's deployed
firebase functions:list

# Rebuild after changes
npm run build
npm run deploy

# Test locally
npm run serve
```

## What You'll Receive

| Type | Frequency | When |
|------|-----------|------|
| 🔴 Device Offline | Once | After 30 min no data |
| ✅ Device Online | Once | When reconnects |
| ⚠️ Threshold Alert | Max 1/hour per parameter | When out of range |
| 📊 Daily Summary | Daily at 8 AM | Every morning |

## Cost: $0.00 ✅

- Firebase: 3,000 / 2,000,000 free invocations
- Gmail: 15 / 500 free emails per day

## Troubleshooting

**No emails?**
- Check spam folder
- Verify: `firebase functions:config:get`
- Check logs: `firebase functions:log`

**Invalid login?**
- Use App Password (not regular password)
- Enable 2FA on Google account

**Functions not running?**
- Verify deployment: `firebase functions:list`
- Check Firebase Console logs

## Files

- `src/index.ts` - Main exports
- `src/notifications/` - Alert logic
- `src/email/` - Email service & templates
- `DEPLOYMENT_GUIDE.md` - Full guide

## Customization

**Change timezone:**
```typescript
// src/index.ts
timeZone: 'America/New_York'
```

**Change daily time:**
```typescript
// src/index.ts
schedule: 'every day 09:00'
```

**Change thresholds:**
```typescript
// src/notifications/thresholdAlerts.ts
const DEFAULT_THRESHOLDS = { ... }
```

**Edit email templates:**
```typescript
// src/email/templates.ts
```

After changes:
```bash
npm run build
npm run deploy
```
