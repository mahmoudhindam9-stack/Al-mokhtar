@echo off
setlocal
title Al-Mokhtar Uninstall
echo.
echo This removes Al-Mokhtar and its app-specific settings from this PC.
echo Other browser profiles and documents outside the app data folder are kept.
echo.
choice /C YN /N /M "Continue? (Y/N) "
if errorlevel 2 exit /b 0
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue';$appName=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('2KfZhNmF2K7Yqtin2LEg2YTYpdiv2KfYsdipINin2YTZhdi02LHZiNi52KfYqg=='));$root=Join-Path $env:LOCALAPPDATA 'Programs\Al-Mokhtar';$entry=Join-Path $root '.output\server\index.mjs';$profile=Join-Path $env:LOCALAPPDATA 'Al-Mokhtar\BrowserProfile';$dataRoot=Join-Path $env:LOCALAPPDATA 'Al-Mokhtar';Get-CimInstance Win32_Process | ForEach-Object { $p=$_; if($p.CommandLine -and (($entry -and $p.CommandLine.Contains($entry)) -or ($profile -and $p.CommandLine.Contains($profile)))) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } };$desktop=[Environment]::GetFolderPath('Desktop');Remove-Item (Join-Path $desktop ($appName+'.lnk')) -Force;Remove-Item (Join-Path (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs') $appName) -Recurse -Force;Start-Sleep -Milliseconds 800;Remove-Item $root -Recurse -Force;Remove-Item $dataRoot -Recurse -Force;Remove-Item (Join-Path $env:APPDATA 'Al-Mokhtar') -Recurse -Force;Write-Host 'Al-Mokhtar and its local app settings were removed.' -ForegroundColor Green"
echo.
echo Uninstall completed.
pause
endlocal
