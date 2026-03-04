# TerraTak Email Notifications - Quick Setup Script
# Run this after you have your Gmail App Password ready

Write-Host "🚀 TerraTak Email Notifications Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the functions directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the /functions directory" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Configure Gmail Credentials" -ForegroundColor Yellow
Write-Host ""

$gmailEmail = Read-Host "Enter your Gmail address"
$gmailPassword = Read-Host "Enter your Gmail App Password (16 characters)" -AsSecureString
$gmailPasswordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($gmailPassword))
$recipientEmail = Read-Host "Enter email to receive alerts (press Enter to use same as Gmail)"

if ([string]::IsNullOrWhiteSpace($recipientEmail)) {
    $recipientEmail = $gmailEmail
}

Write-Host ""
Write-Host "Setting Firebase environment variables..." -ForegroundColor Green

firebase functions:config:set gmail.email="$gmailEmail"
firebase functions:config:set gmail.password="$gmailPasswordText"
firebase functions:config:set notification.recipient="$recipientEmail"

Write-Host ""
Write-Host "✅ Credentials configured!" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Install Dependencies" -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Step 3: Build TypeScript" -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "Step 4: Deploy Functions" -ForegroundColor Yellow
Write-Host "This will deploy 3 Cloud Functions to Firebase..." -ForegroundColor Gray
Write-Host ""

$deploy = Read-Host "Ready to deploy? (y/n)"
if ($deploy -eq "y" -or $deploy -eq "Y") {
    npm run deploy
    
    Write-Host ""
    Write-Host "🎉 Setup Complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You will receive:" -ForegroundColor Cyan
    Write-Host "  📧 Daily summary emails at 8:00 AM" -ForegroundColor White
    Write-Host "  ⚠️  Threshold alerts when conditions are out of range" -ForegroundColor White
    Write-Host "  🔴 Device offline notifications after 30 minutes" -ForegroundColor White
    Write-Host ""
    Write-Host "View logs: firebase functions:log" -ForegroundColor Gray
    Write-Host "Check status: https://console.firebase.google.com" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "Deployment skipped. When ready, run:" -ForegroundColor Yellow
    Write-Host "  npm run deploy" -ForegroundColor White
}
