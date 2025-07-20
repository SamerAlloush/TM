@echo off
echo 🚀 Starting TM Paysage Backend Server
echo ==========================================

echo 🔍 Checking for port conflicts...
netstat -ano | findstr :3001 > nul
if %errorlevel% == 0 (
    echo ⚠️  Port 3001 is in use, killing process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /PID %%a /F > nul 2>&1
    timeout /t 2 > nul
)

echo 🔍 Cleaning up any lingering node processes...
taskkill /F /IM node.exe > nul 2>&1
timeout /t 1 > nul

echo ✅ Starting server...
npm run dev 