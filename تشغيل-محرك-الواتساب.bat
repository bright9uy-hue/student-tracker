@echo off
title WhatsApp Web Engine Launcher (whats-web.js)

echo ====================================================
echo       WhatsApp Web Engine (whats-web.js)
echo ====================================================
echo Starting WhatsApp Engine...

:: Free up port 3001 if occupied
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul

node "%~dp0whats-web.js"

pause
