   - Extract this ZIP file to your server's `/public_html/wa/` directory
   - Ensure all files are uploaded correctly

2. **Install Dependencies**
   ```bash
   cd /public_html/wa/
   npm install
   ```

3. **Set Permissions**
   ```bash
   chmod +x start.sh
   chmod 755 data/ uploads/ auth_info_baileys/
   ```

4. **Start Application**
   ```bash
   ./start.sh
   ```

## Alternative Start Methods

### Using Node.js directly
```bash
cd /public_html/wa/
node server.js
```

### Using PM2 (recommended for production)
```bash
npm install -g pm2
pm2 start server.js --name whatsapp-client
pm2 startup
pm2 save
```

## Access Your Application

After starting the server, access your WhatsApp client at:
- **Primary**: https://inlineeducation.com/wa/
- **Alternative**: http://inlineeducation.com:3000/

## Server Requirements

- Node.js 16 or higher
- NPM (comes with Node.js)
- Internet connection for WhatsApp API
- At least 1GB RAM recommended
- 500MB disk space

## Troubleshooting

### If Node.js is not installed:
```bash
# For Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# For CentOS/RHEL:
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### If you get permission errors:
```bash
sudo chown -R www-data:www-data /public_html/wa/
sudo chmod -R 755 /public_html/wa/
```

### If the port is already in use:
Edit `server.js` and change the PORT variable to a different port number.

## Support

1. Check the README.md file for detailed documentation
2. Review DEPLOYMENT.md for comprehensive deployment instructions
3. Check server logs for any error messages

Good luck with your WhatsApp Client deployment!
"@

$installInstructions | Out-File -FilePath "$tempDir/INSTALL.txt" -Encoding UTF8
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
Write-Host "6. Extract and upload all files from $packageName" -ForegroundColor White
Write-Host "7. Follow the instructions in INSTALL.txt" -ForegroundColor White
Write-Host ""
Write-Host "The package is ready for upload!" -ForegroundColor Green
Write-Host ""

# Show current directory for reference
Write-Host "Package location: $(Get-Location)\$packageName" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to continue..."
