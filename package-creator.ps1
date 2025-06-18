# Manual Deployment Package Creator
# Creates a ZIP file ready for upload to your server

Write-Host "=== Creating WhatsApp Client Deployment Package ===" -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the whatsapp-client directory." -ForegroundColor Red
    exit 1
}

# Create deployment package
$packageName = "whatsapp-client-deployment.zip"
$tempDir = "deployment-temp"

Write-Host "Creating deployment package..." -ForegroundColor Yellow

# Remove old package if exists
if (Test-Path $packageName) {
    Remove-Item $packageName -Force
    Write-Host "Removed existing package" -ForegroundColor Gray
}

# Create temporary directory
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy files to temp directory
Write-Host "Copying files..." -ForegroundColor Yellow

# Main files
$mainFiles = @(
    "package.json",
    "server.js", 
    "README.md",
    "DEPLOYMENT.md",
    "deploy.sh"
)

foreach ($file in $mainFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$tempDir/" -Force
        Write-Host "  Copied: $file" -ForegroundColor Gray
    }
}

# Copy public directory
Copy-Item "public" "$tempDir/" -Recurse -Force
Write-Host "  Copied: public/" -ForegroundColor Gray

# Create empty directories
New-Item -ItemType Directory -Path "$tempDir/data" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir/uploads" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir/auth_info_baileys" -Force | Out-Null
Write-Host "  Created: data/, uploads/, auth_info_baileys/" -ForegroundColor Gray

# Create .gitignore
$gitignoreContent = @"
# Dependencies
node_modules/
npm-debug.log*

# Authentication data (sensitive)
auth_info_baileys/

# User data
data/
uploads/
*.json

# Logs
logs/
*.log

# Environment variables
.env
.env.local

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~
"@

$gitignoreContent | Out-File -FilePath "$tempDir/.gitignore" -Encoding UTF8
Write-Host "  Created: .gitignore" -ForegroundColor Gray

# Create server startup script
$startupScript = @"
#!/bin/bash
echo "Starting WhatsApp Client setup..."

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Set permissions
echo "Setting permissions..."
chmod 755 data/
chmod 755 uploads/
chmod 755 auth_info_baileys/

# Start server
echo "Starting server..."
export NODE_ENV=production
export PORT=3000
node server.js
"@

$startupScript | Out-File -FilePath "$tempDir/start.sh" -Encoding UTF8
Write-Host "  Created: start.sh" -ForegroundColor Gray

# Create .htaccess for Apache servers
$htaccessContent = @"
# WhatsApp Client Configuration
Options -Indexes

# Security Headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY  
Header always set X-XSS-Protection "1; mode=block"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"

# Cache static files
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 month"
    Header set Cache-Control "public, max-age=2592000"
</FilesMatch>

# Gzip compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Protect sensitive directories
<DirectoryMatch "(auth_info_baileys|data)">
    Order Deny,Allow
    Deny from all
</DirectoryMatch>
"@

$htaccessContent | Out-File -FilePath "$tempDir/.htaccess" -Encoding UTF8
Write-Host "  Created: .htaccess" -ForegroundColor Gray

# Create installation instructions
$installContent = "WhatsApp Client Installation Instructions`n`n"
$installContent += "Quick Start:`n"
$installContent += "1. Extract this ZIP file to your server's /public_html/wa/ directory`n"
$installContent += "2. Run: npm install`n"
$installContent += "3. Run: chmod +x start.sh`n"
$installContent += "4. Run: ./start.sh`n`n"
$installContent += "Access your app at: https://inlineeducation.com/wa/`n`n"
$installContent += "For detailed instructions, see README.md and DEPLOYMENT.md files."

$installContent | Out-File -FilePath "$tempDir/INSTALL.txt" -Encoding UTF8
Write-Host "  Created: INSTALL.txt" -ForegroundColor Gray

# Create the ZIP file
Write-Host ""
Write-Host "Creating ZIP package..." -ForegroundColor Yellow

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $packageName)

# Cleanup temp directory
Remove-Item $tempDir -Recurse -Force

# Get file size
$fileSize = (Get-Item $packageName).Length / 1MB
$fileSizeFormatted = "{0:N2} MB" -f $fileSize

Write-Host ""
Write-Host "=== Package Created Successfully ===" -ForegroundColor Green
Write-Host ""
Write-Host "Package file: $packageName" -ForegroundColor Cyan
Write-Host "Package size: $fileSizeFormatted" -ForegroundColor Cyan
Write-Host ""
Write-Host "Manual Upload Instructions:" -ForegroundColor Yellow
Write-Host "1. Download an FTP client (FileZilla, WinSCP, etc.)" -ForegroundColor White
Write-Host "2. Connect to: ftp.inlineeducation.com:21" -ForegroundColor White  
Write-Host "3. Username: claude@inlineeducation.com" -ForegroundColor White
Write-Host "4. Password: AlinaRyan1617!" -ForegroundColor White
Write-Host "5. Navigate to: /public_html/wa/" -ForegroundColor White
Write-Host "6. Extract and upload all files from the ZIP" -ForegroundColor White
Write-Host "7. Follow instructions in INSTALL.txt" -ForegroundColor White
Write-Host ""
Write-Host "Package location: $(Get-Location)\$packageName" -ForegroundColor Cyan
Write-Host ""
Write-Host "The package is ready for upload!" -ForegroundColor Green

Read-Host "Press Enter to continue..."
