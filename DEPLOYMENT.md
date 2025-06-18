# FTP Deployment Instructions

## Server Details
- **FTP Server**: ftp.inlineeducation.com
- **Username**: claude@inlineeducation.com  
- **Port**: 21 (FTP & explicit FTPS)
- **Deployment Directory**: /public_html/wa/

## Automatic Deployment (Recommended)

### Using WinSCP (Windows)
1. Download and install WinSCP from https://winscp.net/
2. Create a new session with these settings:
   - File protocol: FTP
   - Host name: ftp.inlineeducation.com
   - Port number: 21
   - User name: claude@inlineeducation.com
   - Password: [provided separately]
3. Connect and navigate to `/public_html/wa/`
4. Upload all files from the whatsapp-client folder

### Using FileZilla (Cross-platform)
1. Download and install FileZilla from https://filezilla-project.org/
2. Create a new site with these settings:
   - Protocol: FTP - File Transfer Protocol
   - Host: ftp.inlineeducation.com
   - Port: 21
   - Logon Type: Normal
   - User: claude@inlineeducation.com
   - Password: [provided separately]
3. Connect and navigate to `/public_html/wa/`
4. Upload all project files

### Using Command Line FTP (Linux/Mac)
```bash
# Navigate to project directory
cd whatsapp-client

# Create upload script
cat > upload.sh << 'EOL'
#!/bin/bash
echo "Uploading WhatsApp Client to server..."

# Connect to FTP and upload files
ftp -n ftp.inlineeducation.com << EOF
user claude@inlineeducation.com AlinaRyan1617!
cd public_html/wa
lcd .
binary
prompt off
mput *
put package.json
put server.js
put README.md
put deploy.sh
cd public
mput public/*
cd ..
mkdir data
mkdir uploads
mkdir auth_info_baileys
bye
EOF

echo "Upload complete!"
EOL

chmod +x upload.sh
./upload.sh
```

## Manual Deployment Steps

1. **Prepare Files Locally**
   ```bash
   cd whatsapp-client
   npm install
   ```

2. **Create ZIP Archive** (optional, for easier upload)
   ```bash
   zip -r whatsapp-client.zip . -x "node_modules/*"
   ```

3. **Upload via FTP Client**
   - Connect to ftp.inlineeducation.com:21
   - Navigate to `/public_html/wa/`
   - Upload all files except `node_modules/`

4. **Server-side Setup** (if you have SSH access)
   ```bash
   cd /public_html/wa/
   npm install
   chmod +x deploy.sh
   ./deploy.sh
   ```

## Post-Deployment Setup

### 1. Install Node.js on Server
If Node.js is not installed on your server:
```bash
# For Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# For CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 2. Install Dependencies
```bash
cd /public_html/wa/
npm install
```

### 3. Set Permissions
```bash
chmod 755 /public_html/wa/
chmod 755 /public_html/wa/data/
chmod 755 /public_html/wa/uploads/
chmod 755 /public_html/wa/auth_info_baileys/
```

### 4. Start the Application
```bash
# Development mode
npm start

# Production mode with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name whatsapp-client
pm2 startup
pm2 save
```

## Access URLs

After deployment, access your WhatsApp client at:
- **Primary URL**: https://inlineeducation.com/wa/
- **Alternative**: http://inlineeducation.com/wa/

## Firewall & Port Configuration

Make sure your server allows:
- **Inbound**: Port 3000 (or your chosen port) for HTTP
- **Outbound**: Port 443 (HTTPS) for WhatsApp API connections
- **Outbound**: Port 80 (HTTP) for initial connections

## SSL Certificate (Recommended)

For production use, configure SSL:

### Using Let's Encrypt (Free)
```bash
sudo apt install certbot
sudo certbot --apache -d inlineeducation.com
```

### Manual SSL Setup
1. Obtain SSL certificate for your domain
2. Configure your web server to use HTTPS
3. Update application URLs accordingly

## Environment Variables (Production)

Create a `.env` file with production settings:
```bash
NODE_ENV=production
PORT=3000
```

## Monitoring & Maintenance

### Log Management
```bash
# View application logs
pm2 logs whatsapp-client

# Restart application
pm2 restart whatsapp-client

# Stop application
pm2 stop whatsapp-client
```

### Backup Important Data
Regular backup of:
- `/public_html/wa/auth_info_baileys/` (authentication data)
- `/public_html/wa/data/` (templates, contact groups, messages)
- `/public_html/wa/uploads/` (uploaded files)

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   chmod -R 755 /public_html/wa/
   chown -R www-data:www-data /public_html/wa/
   ```

2. **Node.js/NPM Not Found**
   - Ensure Node.js v16+ is installed
   - Add Node.js to PATH if necessary

3. **Port Already in Use**
   - Change PORT in server.js or .env file
   - Kill existing processes: `pkill -f node`

4. **WhatsApp Connection Issues**
   - Check internet connectivity
   - Verify QR code scanning
   - Restart application if needed

### Log Files
- Application logs: Check console output or PM2 logs
- System logs: `/var/log/` directory
- Web server logs: Check Apache/Nginx logs

## Security Checklist

- [ ] Change default passwords
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Regular security updates
- [ ] Backup authentication data
- [ ] Monitor access logs
- [ ] Restrict file upload permissions

## Support

If you encounter issues:
1. Check server logs for errors
2. Verify all dependencies are installed
3. Confirm network connectivity
4. Test with a minimal configuration first

For additional support, check the application logs and ensure all prerequisites are met.
