@echo off
setlocal
title Al Mokhtar ERP - Local Launcher
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

if not exist "%APP_DIR%dist\index.html" (
  echo.
  echo The application build was not found.
  echo For the full offline experience, use the prepared offline package.
  echo For a developer checkout, run npm ci and npm run build first.
  echo.
  pause
  exit /b 1
)

set "NODE_EXE=%APP_DIR%runtime\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. The offline package normally includes its own runtime.
  echo Please reinstall from the complete offline package.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/' -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 } } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://127.0.0.1:3000/"
  exit /b 0
)

start "Al Mokhtar ERP Local Server" /min "%NODE_EXE%" "%APP_DIR%scripts\serve-static.cjs"
set /a ATTEMPTS=0
:WAIT_FOR_SERVER
set /a ATTEMPTS+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/' -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 } } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://127.0.0.1:3000/"
  exit /b 0
)
if %ATTEMPTS% GEQ 15 (
  echo The local server did not start. Check the Node.js runtime and dist folder.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto WAIT_FOR_SERVER
