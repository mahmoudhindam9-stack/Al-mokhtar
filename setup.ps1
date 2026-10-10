$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Restocash ERP - Automated Setup & Installation" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "[1/3] Installing NPM packages..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error installing dependencies." -ForegroundColor Red
    Pause
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[2/3] Creating Desktop Shortcut..." -ForegroundColor Yellow
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Restocash ERP.lnk"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $ScriptDir "start-app.bat"
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.WindowStyle = 1
$Shortcut.Save()

Write-Host ""
Write-Host "[3/3] Setup Completed Successfully!" -ForegroundColor Green
Write-Host "Desktop Shortcut created: Restocash ERP" -ForegroundColor Green
Write-Host ""
Write-Host "Launching Restocash ERP in Standalone Application Mode..." -ForegroundColor Cyan

Start-Process (Join-Path $ScriptDir "start-app.bat")
