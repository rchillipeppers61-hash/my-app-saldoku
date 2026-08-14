@echo off
title Deploy My Wallet
color 0A

echo.
echo  ========================================
echo      DEPLOY APLIKASI MY WALLET
echo  ========================================
echo.

cd "D:\Aplikasi Produksi\my-app-saldoku"

echo  [INFO] Current directory: %CD%
echo.

git status --short > nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Not a git repository!
    goto :error
)

echo  [1/4] Checking for changes...
git status --short
echo.

set /p commit_msg="  Enter commit message (default: update): "
if "%commit_msg%"=="" set commit_msg=update

echo.
echo  [2/4] Staging changes...
git add .

echo  [3/4] Committing: %commit_msg%
git commit -m "%commit_msg%"

if errorlevel 1 (
    echo.
    echo  [WARNING] No changes to commit
    echo.
    set /p force_push="  Push anyway? (y/n): "
    if /i not "%force_push%"=="y" goto :end
)

echo  [4/4] Pushing to GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo  ========================================
    echo         PUSH FAILED!
    echo  ========================================
    echo.
    goto :error
)

echo.
echo  ========================================
echo         DEPLOYMENT SUCCESS!
echo  ========================================
echo.
echo  GitHub: https://github.com/rchillipeppers61-hash/my-wallet
echo  Website: https://dompetku-aghnia.vercel.app/
echo.
echo  Vercel will auto-deploy in 1-2 minutes.
echo.
goto :end

:error
echo.
echo  [ERROR] Deployment failed!
echo.

:end
pause