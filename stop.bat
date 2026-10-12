@echo off
title UMA Tools - Stop
cd /d "%~dp0"

powershell -NoProfile -Command "$serverIds = @(netstat -ano -p tcp | ForEach-Object { if ($_ -match '\sTCP\s+\S+:10010\s+\S+\s+LISTENING\s+(\d+)\s*$') { [int]$Matches[1] } } | Sort-Object -Unique); if ($serverIds.Count -eq 0) { Write-Host '[INFO] UMA Tools server is not running.'; exit 0 }; foreach ($serverId in $serverIds) { $serverProcess = Get-Process -Id $serverId -ErrorAction SilentlyContinue; if (!$serverProcess -or $serverProcess.ProcessName -ne 'node') { Write-Error ('Port 10010 is owned by another process (PID ' + $serverId + ').'); exit 1 }; try { Stop-Process -Id $serverId -ErrorAction Stop; Write-Host ('[OK] Stopped UMA Tools server (PID ' + $serverId + ').') } catch { Write-Error $_; exit 1 } }"
exit /b %errorlevel%
