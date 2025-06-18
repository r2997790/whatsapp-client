# PowerShell FTP Upload Script for WhatsApp Client
# This script uploads the WhatsApp client to your FTP server

param(
    [string]$FtpServer = "ftp.inlineeducation.com",
    [string]$Username = "claude@inlineeducation.com",
    [string]$Password = "AlinaRyan1617!",
    [string]$RemotePath = "/public_html/wa/"
)

Write-Host "=== WhatsApp Client FTP Deployment ===" -ForegroundColor Green
Write-Host ""

# Function to upload file via FTP
function Upload-FileToFtp {
    param(
        [string]$LocalFile,
        [string]$RemoteFile,
        [string]$FtpServer,
        [string]$Username,
        [string]$Password
    )
    
    try {
        $ftpUri = "ftp://$FtpServer$RemoteFile"
        $ftpRequest = [System.Net.FtpWebRequest]::Create($ftpUri)
        $ftpRequest.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
        $ftpRequest.Credentials = New-Object System.Net.NetworkCredential($Username, $Password)
        $ftpRequest.UseBinary = $true
        $ftpRequest.UsePassive = $true
        
        # Read file content
        $fileContent = [System.IO.File]::ReadAllBytes($LocalFile)
        $ftpRequest.ContentLength = $fileContent.Length
        
        # Upload file
        $requestStream = $ftpRequest.GetRequestStream()
        $requestStream.Write($fileContent, 0, $fileContent.Length)
        $requestStream.Close()
        
        # Get response
        $response = $ftpRequest.GetResponse()
        Write-Host "Uploaded: $LocalFile -> $RemoteFile" -ForegroundColor Green
        $response.Close()
        return $true
    }
    catch {
        Write-Host "Failed to upload $LocalFile : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to create FTP directory
function Create-FtpDirectory {
    param(
        [string]$DirectoryPath,
        [string]$FtpServer,
        [string]$Username,
        [string]$Password
    )
    
    try {
        $ftpUri = "ftp://$FtpServer$DirectoryPath"
        $ftpRequest = [System.Net.FtpWebRequest]::Create($ftpUri)
        $ftpRequest.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $ftpRequest.Credentials = New-Object System.Net.NetworkCredential($Username, $Password)
        
        $response = $ftpRequest.GetResponse()
        Write-Host "Created directory: $DirectoryPath" -ForegroundColor Yellow
        $response.Close()
        return $true
    }
    catch {
        # Directory might already exist, which is fine
        return $false
    }
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the whatsapp-client directory." -ForegroundColor Red
    exit 1
}

Write-Host "Starting deployment to $FtpServer..." -ForegroundColor Yellow
Write-Host ""

# Create remote directories
Write-Host "Creating remote directories..." -ForegroundColor Yellow
Create-FtpDirectory "$RemotePath" $FtpServer $Username $Password
Create-FtpDirectory "$RemotePath/public" $FtpServer $Username $Password
Create-FtpDirectory "$RemotePath/data" $FtpServer $Username $Password
Create-FtpDirectory "$RemotePath/uploads" $FtpServer $Username $Password
Create-FtpDirectory "$RemotePath/auth_info_baileys" $FtpServer $Username $Password

Write-Host ""
Write-Host "Uploading files..." -ForegroundColor Yellow

# Upload main files
$mainFiles = @(
    "package.json",
    "server.js",
    "README.md",
    "DEPLOYMENT.md",
    "deploy.sh"
)

foreach ($file in $mainFiles) {
    if (Test-Path $file) {
        Upload-FileToFtp $file "$RemotePath/$file" $FtpServer $Username $Password
    }
}

# Upload public directory files
$publicFiles = Get-ChildItem -Path "public" -File
foreach ($file in $publicFiles) {
    $localPath = $file.FullName
    $remotePath = "$RemotePath/public/$($file.Name)"
    Upload-FileToFtp $localPath $remotePath $FtpServer $Username $Password
}

# Create a simple .htaccess file for Apache
$htaccessContent = @"
# WhatsApp Client .htaccess
RewriteEngine On

# Handle Node.js application
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]

# Security headers
Header always set X-Content-Type-Options nosniff
Header always set X-Frame-Options DENY
Header always set X-XSS-Protection "1; mode=block"

# Cache static files
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 month"
</FilesMatch>
"@

$htaccessFile = "temp_htaccess"
$htaccessContent | Out-File -FilePath $htaccessFile -Encoding UTF8
Upload-FileToFtp $htaccessFile "$RemotePath/.htaccess" $FtpServer $Username $Password
Remove-Item $htaccessFile

# Create server startup script
$startupScript = @"
#!/bin/bash
cd /public_html/wa/
echo "Installing dependencies..."
npm install

echo "Starting WhatsApp Client..."
export NODE_ENV=production
export PORT=3000
node server.js
"@

$startupFile = "temp_start.sh"
$startupScript | Out-File -FilePath $startupFile -Encoding UTF8
Upload-FileToFtp $startupFile "$RemotePath/start.sh" $FtpServer $Username $Password
Remove-Item $startupFile

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. SSH into your server (if available)" -ForegroundColor White
Write-Host "2. Navigate to /public_html/wa/" -ForegroundColor White
Write-Host "3. Run: npm install" -ForegroundColor White
Write-Host "4. Run: chmod +x start.sh" -ForegroundColor White
Write-Host "5. Run: ./start.sh" -ForegroundColor White
Write-Host ""
Write-Host "Your WhatsApp client will be available at:" -ForegroundColor Yellow
Write-Host "https://inlineeducation.com/wa/" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you don't have SSH access, contact your hosting provider to:" -ForegroundColor Yellow
Write-Host "- Install Node.js (version 16 or higher)" -ForegroundColor White
Write-Host "- Run 'npm install' in the /public_html/wa/ directory" -ForegroundColor White
Write-Host "- Start the application with 'node server.js'" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to continue..."
