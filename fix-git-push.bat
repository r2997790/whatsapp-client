@echo off
echo 🔧 Fixing Git Push Error - WhatsApp Client Deployment
echo =====================================================
echo.

echo 📋 Current branch status:
git branch

echo.
echo 🚀 Pushing to master branch...
git push -u origin master

echo.
echo ✅ If successful, your WhatsApp client code is now on GitHub!
echo.
echo 📖 Next steps:
echo 1. Go to Railway Dashboard: https://railway.app/project/fab5af90-632e-4cd0-99fc-147ef97ad35e
echo 2. Click on the 'nodejs' service
echo 3. Go to Settings → Source
echo 4. Connect your GitHub repository: r2997790/whatsapp-client
echo 5. Set branch to 'master'
echo 6. Save and redeploy
echo.
echo 🌐 Your WhatsApp client will then be live at:
echo https://nodejs-production-4bcd.up.railway.app
echo.
pause