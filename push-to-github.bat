@echo off
echo ========================================
echo   PHONEMART - Push to GitHub
echo ========================================
echo.

echo Step 1: Create a GitHub repository first!
echo.
echo Go to: https://github.com/new
echo.
echo Repository name: phonemart-admin
echo (or any name you like)
echo.
echo IMPORTANT: Do NOT check any boxes!
echo (No README, No .gitignore, No license)
echo.
echo After creating, copy the repository URL
echo (It will look like: https://github.com/YOUR_USERNAME/phonemart-admin.git)
echo.
pause

echo.
echo Step 2: Enter your GitHub repository URL
echo (Example: https://github.com/yourusername/phonemart-admin.git)
set /p REPO_URL="Repository URL: "

echo.
echo Adding remote repository...
git remote add origin %REO_URL%

echo.
echo Pushing code to GitHub...
git branch -M main
git push -u origin main

echo.
echo ========================================
echo   SUCCESS! Your code is on GitHub!
echo ========================================
echo.
echo Next step: Deploy to Vercel
echo Go to: https://vercel.com
echo.
pause
