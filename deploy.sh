#!/bin/bash

# WhatsApp Client Deployment Script

echo "=== WhatsApp Client Deployment ==="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

echo "1. Installing dependencies..."
npm install

echo ""
echo "2. Creating necessary directories..."
mkdir -p data
mkdir -p uploads
mkdir -p auth_info_baileys

echo ""
echo "3. Setting permissions..."
chmod 755 data
chmod 755 uploads
chmod 755 auth_info_baileys

echo ""
echo "4. Creating .gitignore..."
cat > .gitignore << EOL
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
EOL

echo ""
echo "5. Creating production start script..."
cat > start.sh << 'EOL'
#!/bin/bash
echo "Starting WhatsApp Client..."
export NODE_ENV=production
export PORT=3001
node server.js
EOL

chmod +x start.sh

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "To start the application:"
echo "  npm start"
echo ""
echo "Or for production:"
echo "  ./start.sh"
echo ""
echo "The application will be available at:"
echo "  http://localhost:3000 (development)"
echo "  http://localhost:3001 (production)"
echo ""
echo "Make sure to:"
echo "1. Install Node.js (v16 or higher) on your server"
echo "2. Upload all files to your server"
echo "3. Run 'npm install' on the server"
echo "4. Start the application with 'npm start' or './start.sh'"
echo ""
