$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir
$AppName = "المختار لإدارة المشروعات"
$StartScript = Join-Path $ScriptDir "start-app.bat"
$DistEntry = Join-Path $ScriptDir "dist\index.html"

Write-Host "============================================" -ForegroundColor DarkYellow
Write-Host "  المختار لإدارة المشروعات - التثبيت" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor DarkYellow
Write-Host ""

if (-not (Test-Path $StartScript)) {
  throw "ملف تشغيل البرنامج start-app.bat غير موجود. أعد تنزيل حزمة Al-Mokhtar الكاملة."
}

if (-not (Test-Path $DistEntry)) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) {
    throw "ملفات البرنامج المبنية غير موجودة. نزّل حزمة Al-Mokhtar الجاهزة، أو ثبّت Node.js 22+ للبناء من ملفات المصدر."
  }
  Write-Host "بناء ملفات البرنامج لأول مرة..." -ForegroundColor Yellow
  & $npm.Source install --include=optional
  if ($LASTEXITCODE -ne 0) { throw "فشل تثبيت اعتماديات البرنامج." }
  & $npm.Source run build
  if ($LASTEXITCODE -ne 0) { throw "فشل بناء البرنامج." }
}
if (-not (Test-Path $DistEntry)) { throw "ملف التشغيل dist\index.html غير موجود بعد البناء." }

$DesktopPath = [Environment]::GetFolderPath("Desktop")
$StartMenuPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\المختار لإدارة المشروعات"
New-Item -ItemType Directory -Force -Path $StartMenuPath | Out-Null
$IconPath = Join-Path $ScriptDir "dist\favicon.ico"
if (-not (Test-Path $IconPath)) { $IconPath = Join-Path $ScriptDir "public\favicon.ico" }
$WshShell = New-Object -ComObject WScript.Shell

foreach ($ShortcutPath in @(
  (Join-Path $DesktopPath "$AppName.lnk"),
  (Join-Path $StartMenuPath "$AppName.lnk")
)) {
  $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = $StartScript
  $Shortcut.WorkingDirectory = $ScriptDir
  $Shortcut.WindowStyle = 7
  if (Test-Path $IconPath) { $Shortcut.IconLocation = "$IconPath,0" }
  $Shortcut.Description = "المختار لإدارة المشروعات - نظام إدارة المشروعات والمحاسبة"
  $Shortcut.Save()
}
Write-Host "تم إنشاء اختصارات سطح المكتب وقائمة Start." -ForegroundColor Green
Write-Host "جاري تشغيل المختار..." -ForegroundColor Cyan
Start-Process -FilePath $StartScript -WorkingDirectory $ScriptDir
