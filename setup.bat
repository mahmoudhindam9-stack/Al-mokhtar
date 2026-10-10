@echo off
title Restocash ERP Setup
echo ===================================================
echo    Restocash ERP - Automated Setup & Installation
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Installing NPM packages...
call npm install
if %ERRORLEVEL% neq 0 (
    echo Error during npm install. Please verify Node.js is installed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Creating Desktop Shortcut for Restocash ERP...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'Restocash ERP.lnk')); $s.TargetPath='%~dp0start-app.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=1; $s.Save()"

echo.
echo [3/3] Setup Completed Successfully!
echo Shortcut 'Restocash ERP' has been created on your Desktop.
echo.
echo Launching Restocash ERP as a standalone application...
call "%~dp0start-app.bat"
