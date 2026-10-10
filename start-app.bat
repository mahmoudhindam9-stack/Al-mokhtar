@echo off
setlocal
title المختار لإدارة المشروعات
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

if not exist "%APP_DIR%dist\index.html" (
  echo لم يتم العثور على ملفات البرنامج المبنية.
  echo شغل setup.bat اولا او قم بتنزيل حزمة Al-Mokhtar الكاملة.
  pause
  exit /b 1
)

set "NODE_EXE=%APP_DIR%runtime\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo لم يتم العثور على Node.js. نزّل حزمة Al-Mokhtar الكاملة التي تتضمن runtime.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/' -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 } } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://127.0.0.1:3000/"
  exit /b 0
)

start "Al Mokhtar Local Server" /min "%NODE_EXE%" "%APP_DIR%scripts\serve-static.cjs"
set /a ATTEMPTS=0
:WAIT_FOR_SERVER
set /a ATTEMPTS+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/' -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 } } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://127.0.0.1:3000/"
  exit /b 0
)
if %ATTEMPTS% GEQ 20 (
  echo لم يبدأ الخادم المحلي. تحقق من ملفات runtime و dist.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto WAIT_FOR_SERVER
