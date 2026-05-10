# Backend Django avec le venv GPU (Python 3.12 + PyTorch cu118).
# Usage: .\run-dev.ps1 runserver
# Si 8000, 8001, ... sont pris, choisit automatiquement le premier port libre (8000-8015).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# Réduit la fragmentation VRAM sur petites cartes (ex. 2 Go).
$env:PYTORCH_CUDA_ALLOC_CONF = 'expandable_segments:True'

# Charge les variables de .env (DB_*, EMAIL_*, etc.) pour éviter les erreurs de connexion locale.
$envFile = Join-Path $here '.env'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $parts = $line -split '=', 2
        if ($parts.Count -ne 2) { return }
        $k = $parts[0].Trim()
        $v = $parts[1].Trim().Trim('"').Trim("'")
        if ($k) {
            [Environment]::SetEnvironmentVariable($k, $v, 'Process')
        }
    }
    Write-Host "[run-dev] Variables chargees depuis .env"
}

# Le check torch peut parfois se figer sur certaines configs GPU/driver.
# On l'encapsule dans un job avec timeout pour ne jamais bloquer le lancement serveur.
$torchScript = "import torch; print('PyTorch', torch.__version__, '| cuda.is_available=', torch.cuda.is_available(), '| device_count=', torch.cuda.device_count() if torch.cuda.is_available() else 0)"
$torchJob = Start-Job -ScriptBlock {
    param([string]$pythonExe, [string]$script)
    & $pythonExe -c $script 2>&1
} -ArgumentList "$here\.venv\Scripts\python.exe", $torchScript

if (Wait-Job -Job $torchJob -Timeout 12) {
    $torchCk = ((Receive-Job -Job $torchJob) | Out-String).Trim()
    if ($torchCk) {
        Write-Host "[run-dev] $torchCk"
    } else {
        Write-Host "[run-dev] Torch check terminé (sortie vide)."
    }
} else {
    Stop-Job -Job $torchJob -ErrorAction SilentlyContinue | Out-Null
    Write-Host "[run-dev] Torch check timeout (>12s). Démarrage du serveur sans blocage..." -ForegroundColor Yellow
}
Remove-Job -Job $torchJob -Force -ErrorAction SilentlyContinue | Out-Null

function Test-PortHasListener {
    param([int]$Port)
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.ReceiveTimeout = 400
        $c.SendTimeout = 400
        $iar = $c.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(500, $false)) {
            $c.Close()
            return $false
        }
        $c.EndConnect($iar)
        $ok = $c.Connected
        $c.Close()
        return $ok
    } catch {
        return $false
    }
}

$toPass = $args
if ($toPass.Count -eq 1 -and $toPass[0] -eq 'runserver') {
    $chosen = $null
    foreach ($p in 8000..8015) {
        if (-not (Test-PortHasListener -Port $p)) {
            $chosen = $p
            break
        }
    }
    if ($null -eq $chosen) {
        Write-Host '[run-dev] Aucun port libre entre 8000 et 8015. Ferme les anciens serveurs ou lance: .\run-dev.ps1 runserver 9000' -ForegroundColor Red
        exit 1
    }
    if ($chosen -ne 8000) {
        Write-Host "[run-dev] Ports 8000-$($chosen - 1) pris - demarrage sur le port $chosen." -ForegroundColor Yellow
    }
    $toPass = @('runserver', "$chosen")
}

& "$here\.venv\Scripts\python.exe" "$here\manage.py" @toPass
