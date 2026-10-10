@echo off
setlocal
title إلغاء تثبيت المختار لإدارة المشروعات
echo.
echo سيتم حذف برنامج المختار واختصاراته وبياناته المحلية الخاصة به من هذا الجهاز.
echo لن يتم حذف ملفاتك الشخصية خارج مجلد بيانات المختار.
echo.
choice /C YN /N /M "هل تريد المتابعة؟ (Y/N) "
if errorlevel 2 exit /b 0
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue';$root=Join-Path $env:LOCALAPPDATA 'Programs\Al-Mokhtar';$entry=Join-Path $root '.output\server\index.mjs';$profile=Join-Path $env:LOCALAPPDATA 'Al-Mokhtar\BrowserProfile';$dataRoot=Join-Path $env:LOCALAPPDATA 'Al-Mokhtar';$needles=@($entry,$profile);Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($needles | Where-Object { $_ -and $_.Length -gt 0 -and $_.CommandLine.Contains($_) }) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force };$desk=[Environment]::GetFolderPath('Desktop');Remove-Item (Join-Path $desk 'المختار لإدارة المشروعات.lnk') -Force;Remove-Item (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\المختار لإدارة المشروعات') -Recurse -Force;Start-Sleep -Milliseconds 800;Remove-Item $root -Recurse -Force;Remove-Item $dataRoot -Recurse -Force;Remove-Item (Join-Path $env:APPDATA 'Al-Mokhtar') -Recurse -Force;Write-Host 'تم حذف المختار وإعداداته المحلية.' -ForegroundColor Green"
echo.
echo تم الانتهاء من إلغاء التثبيت.
pause
endlocal
