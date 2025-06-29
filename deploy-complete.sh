#!/bin/bash

# WhatsApp Enhanced v3 - Complete Deployment Script

echo "🚀 Starting WhatsApp Enhanced v3 deployment to Railway..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Add all files
echo "📂 Adding files to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "WhatsApp Enhanced v3 - Complete Personalization Implementation

✅ COMPLETED FEATURES:
- Full Personalization Tab with comprehensive UI
- PersonalizationManager with token system  
- Template integration and management
- Multi-recipient selection (single, multiple, group, all)
- Real-time message preview with personalization
- Interactive token insertion system
- Bulk messaging with personalization
- Quick actions and modal workflows
- Complete app.js integration
- Backend API endpoints for bulk messaging
- Token replacement engine
- Statistics tracking and preview system

🔧 TECHNICAL IMPLEMENTATION:
- PersonalizationManager class with full functionality
- Updated HTML structure with personalization tab
- Integrated with existing WhatsApp client
- Modal-based quick personalization workflows
- Bulk messaging API with delay handling
- Token detection and variable extraction
- Contact/group data integration
- Real-time preview generation

📊 SYSTEM STATUS:
- Step 4.1: Complete HTML Structure ✅
- Step 4.2: PersonalizationManager Implementation ✅  
- Step 4.3: App.js Integration ✅
- Step 4.4: Ready for Testing & Deployment ✅

🎯 READY FOR PRODUCTION TESTING"

# Check if railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway authentication..."
railway login

# Create new Railway project if it doesn't exist
echo "🚂 Setting up Railway project..."
railway link || railway init

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your WhatsApp Enhanced v3 app should be available at your Railway URL"
echo "📋 Check Railway dashboard for deployment status and logs"
