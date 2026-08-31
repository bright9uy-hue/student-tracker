@echo off
chcp 65001 >nul
title متابعة أداء الطلاب

cd /d "%~dp0"

:: Start Node.js Server in background (minimized)
start /min "StudentTrackerServer" node server.js

:: Start WhatsApp Engine in background (minimized)
start /min "StudentTrackerWhatsApp" node whats-web.js

:: Wait 2 seconds for server initialization
timeout /t 2 /nobreak >nul

:: Launch Standalone App Window Mode
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8000/
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8000/
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8000/
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:8000/
) else (
    start http://127.0.0.1:8000/
)

exit