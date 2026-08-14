@echo off
title Aplikasi My Wallet
color 1F
echo ================================================
echo          VITE + REACT DEVELOPMENT SERVER
echo ================================================
echo.
echo [*] Memulai aplikasi...
echo.

cd /d "D:\Aplikasi Produksi\my-app-saldoku"

if not exist "package.json" (
    echo [ERROR] File package.json tidak ditemukan!
    echo Pastikan folder aplikasi sudah benar.
    echo.
    pause
    exit
)

if not exist "vite.config.js" (
    echo [ERROR] File vite.config.js tidak ditemukan!
    echo Pastikan ini adalah project Vite.
    echo.
    pause
    exit
)

echo [*] Menjalankan npm run dev...
echo.
echo ================================================
echo.
echo [INFO] Server biasanya berjalan di: http://localhost:3000
echo [INFO] Browser akan terbuka otomatis saat server siap
echo [INFO] Tekan CTRL + C untuk menghentikan server
echo.
echo ================================================
echo.

npm run dev

echo.
echo ================================================
echo [*] Development server telah ditutup
echo ================================================
echo.
pause