$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "============================================" -ForegroundColor DarkYellow
Write-Host "  Al-Mokhtar - Local Offline Setup" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor DarkYellow
Write-Host ""

$bundledNode = Join-Path $root "runtime\node.exe"
$bundledNpm = Join-Path $root "runtime\npm.cmd"
$nodeExe = $null
$npmCmd = $null

if (Test-Path $bundledNode) {
    $nodeExe = $bundledNode
    if (Test-Path $bundledNpm) { $npmCmd = $bundledNpm }
} else {
    $systemNode = Get-Command node -ErrorAction SilentlyContinue
    if ($systemNode) {
        $versionText = (& $systemNode.Source --version).Trim().TrimStart("v")
        try {
            if ([version]$versionText -ge [version]"22.12.0") {
                $nodeExe = $systemNode.Source
                $systemNpm = Get-Command npm.cmd -ErrorAction SilentlyContinue
                if ($systemNpm) { $npmCmd = $systemNpm.Source }
            }
        } catch { }
    }
}

if (-not $nodeExe) {
    Write-Host "Node.js 22.12+ is not installed. Downloading a portable runtime..." -ForegroundColor Yellow
    try {
        $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -TimeoutSec 20
        $release = $index | Where-Object { $_.version -like "v22.*" } | Select-Object -First 1
        if (-not $release) { throw "Could not find a Node.js 22 release." }
        $archiveName = "node-$($release.version)-win-x64.zip"
        $archiveUrl = "https://nodejs.org/dist/$($release.version)/$archiveName"
        $tempArchive = Join-Path $env:TEMP $archiveName
        $tempExtract = Join-Path $env:TEMP ("almokhtar-node-" + [guid]::NewGuid().ToString("N"))
        Invoke-WebRequest -Uri $archiveUrl -OutFile $tempArchive -TimeoutSec 180
        Expand-Archive -Path $tempArchive -DestinationPath $tempExtract -Force
        $runtimeDir = Join-Path $root "runtime"
        New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
        Copy-Item (Join-Path $tempExtract "$($archiveName -replace '\.zip$','')\*") $runtimeDir -Recurse -Force
        Remove-Item $tempArchive -Force -ErrorAction SilentlyContinue
        Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
        $nodeExe = $bundledNode
        $npmCmd = $bundledNpm
    } catch {
        throw "This copy does not include the offline runtime. Connect to the internet once, or download the 'Al-Mokhtar-Offline' package which includes Node.js and dependencies. Details: $($_.Exception.Message)"
    }
}

if (-not $nodeExe -or -not (Test-Path $nodeExe)) {
    throw "Node.js could not be prepared."
}

$productionEntry = Join-Path $root ".output\server\index.mjs"

if (-not (Test-Path $productionEntry) -and -not (Test-Path (Join-Path $root "node_modules\vite\bin\vite.js"))) {
    if (-not $npmCmd) {
        $systemNpm = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if ($systemNpm) { $npmCmd = $systemNpm.Source }
    }
    if (-not $npmCmd) {
        throw "The npm runtime is missing. Download the complete Al-Mokhtar-Offline package."
    }
    Write-Host "Installing application dependencies. Internet is needed only for this first install..." -ForegroundColor Yellow
    & $npmCmd ci
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency installation failed. For first-run offline use, download the complete Al-Mokhtar-Offline package."
    }
}

$url = "http://127.0.0.1:3000"
Write-Host "Starting Al-Mokhtar locally at $url" -ForegroundColor Green
if (Test-Path $productionEntry) {
    $env:PORT = "3000"
    $env:HOST = "127.0.0.1"
    $env:NITRO_PORT = "3000"
    $env:NITRO_HOST = "127.0.0.1"
    $argumentLine = '"' + $productionEntry + '"'
} else {
    $argumentLine = 'node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3000 --strictPort'
}
$server = Start-Process -FilePath $nodeExe -ArgumentList $argumentLine -WorkingDirectory $root -PassThru

$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if ($server.HasExited) {
        throw "The local application stopped during startup. Check port 3000 and run setup again."
    }
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            $ready = $true
            break
        }
    } catch { }
}
if (-not $ready) {
    Write-Warning "The local server has not responded yet. Open $url after the console shows that Vite is ready."
} else {
    Start-Process $url
    Write-Host "Al-Mokhtar is running. Keep its console window open." -ForegroundColor Green
}
