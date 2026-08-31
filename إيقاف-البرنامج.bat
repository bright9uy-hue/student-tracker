@echo off
title Closing Student Tracker
echo Closing background servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /f /pid %%a 2>nul
echo Successfully stopped.
timeout /t 2 >nul
