@echo off
title UMA Tools
cd /d "%~dp0"

echo.
echo  === UMA Tools Server ===
echo.
echo  Working directory: %CD%
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found.
    pause
    exit /b 1
)

node --version
call npm --version

echo.

if not exist "node_modules" (
    echo  [INFO] node_modules not found - running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo.
echo  [OK] Starting server at http://localhost:10010
echo  Press Ctrl+C to stop.
echo.

start "" "http://localhost:10010"
node server.js

echo.
echo  Server stopped (exit code: %errorlevel%)
pause
