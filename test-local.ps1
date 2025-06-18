# Test WhatsApp Client Locally

Write-Host "=== Testing WhatsApp Client Locally ===" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the whatsapp-client directory." -ForegroundColor Red
    exit 1
}

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "Starting local test server..." -ForegroundColor Yellow
Write-Host "The server will start on http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server when you're done testing." -ForegroundColor Gray
Write-Host ""

# Start the server
node server.js
