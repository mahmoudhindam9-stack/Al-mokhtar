@echo off
setlocal
title المختار لإدارة المشروعات
set "APP_DIR=%~dp0"
set "NODE_EXE=%APP_DIR%runtime\node.exe"
set "SERVER_ENTRY=%APP_DIR%.output\server\index.mjs"
set "APP_URL=http://127.0.0.1:3000/"
set "BROWSER_PROFILE=%LOCALAPPDATA%\Al-Mokhtar\BrowserProfile"
cd /d "%APP_DIR%"

if not exist "%NODE_EXE%" (
  echo لم يتم العثور على Runtime المرفق بالبرنامج.
  pause
  exit /b 1
)
if not exist "%SERVER_ENTRY%" (
  echo ملفات الخادم المحلي غير مكتملة. أعد تثبيت المختار.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%APP_URL%' -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ exit 0 } } catch { exit 1 }"
if not errorlevel 1 goto OPEN_APP

set "PORT=3000"
set "HOST=127.0.0.1"
set "NITRO_PORT=3000"
set "NITRO_HOST=127.0.0.1"
start "Al-Mokhtar Local Server" /min "%NODE_EXE%" "%SERVER_ENTRY%"
set /a ATTEMPTS=0
:WAIT_FOR_SERVER
set /a ATTEMPTS+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%APP_URL%' -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ exit 0 } } catch { exit 1 }"
if not errorlevel 1 goto OPEN_APP
if %ATTEMPTS% GEQ 25 (
  echo لم يبدأ الخادم المحلي. تحقق من ملفات البرنامج.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto WAIT_FOR_SERVER

:OPEN_APP
if not exist "%BROWSER_PROFILE%" mkdir "%BROWSER_PROFILE%" >nul 2>&1
set "BROWSER_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXE if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if defined BROWSER_EXE (
  start "" "%BROWSER_EXE%" --app="%APP_URL%" --user-data-dir="%BROWSER_PROFILE%" --no-first-run
) else (
  echo تنبيه: لم يتم العثور على Edge أو Chrome. ستفتح الصفحة في المتصفح الافتراضي.
  start "" "%APP_URL%"
)
exit /b 0
