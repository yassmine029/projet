# Backend Django avec le venv GPU (Python 3.12 + PyTorch cu118).
# Usage: .\run-dev.ps1 runserver
# Si 8000, 8001, ... sont pris, choisit automatiquement le premier port libre (8000-8015).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# Réduit la fragmentation VRAM sur petites cartes (ex. 2 Go).
$env:PYTORCH_CUDA_ALLOC_CONF = 'expandable_segments:True'

$torchCk = & "$here\.venv\Scripts\python.exe" -c "import torch; print('PyTorch', torch.__version__, '| cuda.is_available=', torch.cuda.is_available(), '| device_count=', torch.cuda.device_count() if torch.cuda.is_available() else 0)" 2>&1
Write-Host "[run-dev] $torchCk"

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
