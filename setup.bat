@echo off
setlocal
title المختار لإدارة المشروعات - Setup
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Read the error above.
  pause
)
endlocal
