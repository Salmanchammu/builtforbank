@echo off
title SmartBank V2 Server
echo ===================================================
echo     SMART BANK V2 - One Click Start
echo ===================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to PATH!
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b
)

echo [INFO] Python found. Installing required dependencies...
pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Some dependencies had issues. Trying individually...
    pip install Flask Flask-CORS Werkzeug reportlab requests cryptography >nul 2>&1
)
echo [INFO] Dependencies ready.

echo.
echo [INFO] Starting Backend Server and Database...
echo [INFO] A browser window will open automatically.
echo [INFO] Keep this window open to keep the server running.
echo [INFO] Press Ctrl+C to stop the server.
echo.

REM Open browser after 3 seconds
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000/"

REM Start the server
python backend\main.py

pause
