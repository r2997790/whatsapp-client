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
