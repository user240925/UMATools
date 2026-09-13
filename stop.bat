@echo off
chcp 65001 >nul
echo ========================================
echo UMA Tools 關閉中...
echo ========================================
echo.

REM 查找並終止 server.js 進程
echo [提示] 正在尋找 UMA Tools 服務器進程...

REM 使用 netstat 查找佔用 3001 端口的進程
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    set PID=%%a
)

if defined PID (
    echo [找到] 進程 ID: %PID%
    echo [執行] 正在終止進程...
    taskkill /F /PID %PID% >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [成功] UMA Tools 服務器已關閉
    ) else (
        echo [錯誤] 無法終止進程 (可能需要管理員權限)
    )
) else (
    echo [提示] 未找到運行中的 UMA Tools 服務器
    echo [提示] 端口 3001 沒有被佔用
)

echo.
echo ========================================
pause
