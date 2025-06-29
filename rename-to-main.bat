@echo off
echo 🔄 Renaming branch to main - WhatsApp Client Deployment
echo ======================================================
echo.

echo 📋 Current branch: master
echo 🔄 Renaming to main...

git branch -M main

echo ✅ Branch renamed to main
echo.
echo 🚀 Pushing to main branch...
git push -u origin main

echo.
echo ✅ If successful, your WhatsApp client code is now on GitHub!
echo.
echo 📖 Next steps:
echo 1. Go to Railway Dashboard: https://railway.app/project/fab5af90-632e-4cd0-99fc-147ef97ad35e
echo 2. Click on the 'nodejs' service
echo 3. Go to Settings → Source
echo 4. Connect your GitHub repository: r2997790/whatsapp-client
echo 5. Set branch to 'main'
echo 6. Save and redeploy
echo.
echo 🌐 Your WhatsApp client will then be live at:
echo https://nodejs-production-4bcd.up.railway.app
echo.
pause