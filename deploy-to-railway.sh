#!/bin/bash

echo "🚀 WhatsApp Client - Railway Deployment Helper"
echo "=============================================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📝 Initializing Git repository..."
    git init
    echo "✅ Git initialized"
fi

# Add all files
echo "📁 Adding files to Git..."
git add .

# Commit
echo "💾 Committing changes..."
git commit -m "WhatsApp Client deployment - $(date)"

# Check if remote exists
if ! git remote get-url origin &> /dev/null; then
    echo ""
    echo "⚠️  Please add your GitHub repository remote:"
    echo "   git remote add origin https://github.com/yourusername/whatsapp-client.git"
    echo ""
    echo "📋 Then run:"
    echo "   git push -u origin main"
else
    echo "🚀 Pushing to repository..."
    git push
fi

echo ""
echo "🌟 Deployment Information:"
echo "-------------------------"
echo "Railway Project: whatsapp-messaging-client"
echo "Service URL: https://nodejs-production-4bcd.up.railway.app"
echo "Project ID: fab5af90-632e-4cd0-99fc-147ef97ad35e"
echo ""
echo "📖 Next Steps:"
echo "1. Connect this repository to your Railway service"
echo "2. Wait for automatic deployment"
echo "3. Visit your URL to start using WhatsApp client"
echo ""
echo "✨ Happy messaging!"