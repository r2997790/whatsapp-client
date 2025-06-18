#!/bin/bash

# Create directories if they don't exist
mkdir -p auth_info_baileys
mkdir -p data  
mkdir -p uploads

# Set permissions
chmod 755 auth_info_baileys
chmod 755 data
chmod 755 uploads

echo "Starting WhatsApp Web Client..."
echo "Port: ${PORT:-3000}"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

# Start the application
exec npm start