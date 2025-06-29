@echo off
REM WhatsApp Enhanced v3 - Complete Deployment Script for Windows

echo 🚀 Starting WhatsApp Enhanced v3 deployment to Railway...

REM Check if git is initialized
if not exist ".git" (
    echo 📦 Initializing git repository...
    git init
)

REM Add all files
echo 📂 Adding files to git...
git add .

REM Commit changes
echo 💾 Committing changes...
git commit -m "WhatsApp Enhanced v3 - Complete Personalization Implementation - ✅ COMPLETED FEATURES: Full Personalization Tab, PersonalizationManager, Token system, Template integration, Multi-recipient selection, Real-time preview, Bulk messaging, Complete app.js integration, Backend API endpoints"

REM Check if railway CLI is available
railway --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Railway CLI not found. Please install it first:
    echo npm install -g @railway/cli
    pause
    exit /b 1
)

REM Login to Railway (if not already logged in)
echo 🔐 Checking Railway authentication...
railway login

REM Create new Railway project if it doesn't exist
echo 🚂 Setting up Railway project...
railway link || railway init

REM Deploy to Railway
echo 🚀 Deploying to Railway...
railway up

echo ✅ Deployment complete!
echo 🌐 Your WhatsApp Enhanced v3 app should be available at your Railway URL
echo 📋 Check Railway dashboard for deployment status and logs
pause
