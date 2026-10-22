param(
    [int]$Port = 7860,
    [switch]$Build,
    [switch]$NoTunnel,
    [string]$Domain = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Dist = Join-Path $Frontend "dist"
$EnvFile = Join-Path $Backend ".env"
$Health = "http://127.0.0.1:$Port/api/health"
$backendProcess = $null
$tunnelProcess = $null

function Write-Step($Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not (Test-Path $EnvFile)) {
    Write-Host "backend\.env belum ada. Salin backend\.env.example lalu isi FIRMS_KEY, OWM_KEY, dan WAQI_KEY." -ForegroundColor Yellow
    exit 1
}

if ($Build -or -not (Test-Path $Dist)) {
    Write-Step "Membangun frontend"
    Push-Location $Frontend
    try {
        npm run build
    } finally {
        Pop-Location
    }
} else {
    Write-Step "frontend\dist sudah ada, build dilewati"
}

$alreadyRunning = $false
try {
    Invoke-RestMethod $Health -TimeoutSec 3 | Out-Null
    $alreadyRunning = $true
} catch {
    $alreadyRunning = $false
}

if (-not $alreadyRunning) {
    Write-Step "Menjalankan Flask di port $Port"
    $env:PORT = "$Port"
    $backendProcess = Start-Process -FilePath "python" -ArgumentList "app.py" -WorkingDirectory $Backend -PassThru -NoNewWindow
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            Invoke-RestMethod $Health -TimeoutSec 2 | Out-Null
            $ready = $true
            break
        } catch {
            if ($backendProcess.HasExited) { break }
        }
    }
    if (-not $ready) {
        Write-Host "Backend gagal siap. Jalankan python app.py di folder backend untuk melihat galat." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Aplikasi lokal: http://127.0.0.1:$Port" -ForegroundColor Green

if (-not $NoTunnel) {
    $ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $ngrok) {
        Write-Host "ngrok belum terpasang. Pasang dengan: winget install ngrok.ngrok" -ForegroundColor Yellow
        Write-Host "Aplikasi tetap bisa dipakai lokal di http://127.0.0.1:$Port" -ForegroundColor Yellow
    } else {
        $ngrokArgs = @("http", "$Port", "--log", "stdout")
        if ($Domain) {
            $cleanDomain = $Domain -replace "^https?://", "" -replace "/.*$", ""
            $ngrokArgs += @("--url", "https://$cleanDomain")
        }
        Write-Step "Membuka tunnel ngrok"
        $tunnelProcess = Start-Process -FilePath $ngrok.Source -ArgumentList $ngrokArgs -PassThru -NoNewWindow
        $publicUrl = $null
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            Start-Sleep -Milliseconds 500
            try {
                $info = Invoke-RestMethod "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
                $publicUrl = ($info.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1).public_url
                if ($publicUrl) { break }
            } catch {
                $publicUrl = $null
            }
        }
        if ($publicUrl) {
            Write-Host "URL publik: $publicUrl" -ForegroundColor Green
            try {
                Invoke-RestMethod "$publicUrl/api/health" -Headers @{ "ngrok-skip-browser-warning" = "1" } -TimeoutSec 20 | Out-Null
                Write-Host "Verifikasi $($publicUrl)/api/health: OK" -ForegroundColor Green
            } catch {
                Write-Host "Verifikasi lewat tunnel belum berhasil: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "URL tunnel belum terbaca. Buka http://127.0.0.1:4040 untuk melihat status ngrok." -ForegroundColor Yellow
        }
    }
}

Write-Host "Tekan Ctrl+C untuk menghentikan."
try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($backendProcess -and $backendProcess.HasExited) {
            Write-Host "Backend berhenti." -ForegroundColor Yellow
            break
        }
    }
} finally {
    foreach ($process in @($backendProcess, $tunnelProcess)) {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
