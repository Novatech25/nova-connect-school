# ===============================================
# NovaConnect Gateway - Script de Stop
# ===============================================

$serviceName = "NovaConnectGateway"

Write-Host "Arret de NovaConnect Gateway..." -ForegroundColor Cyan

try {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if (!$service) {
        Write-Error "Service '$serviceName' non trouve"
        exit 1
    }

    if ($service.Status -eq "Stopped") {
        Write-Host "Le service est deja arrete" -ForegroundColor Yellow
        exit 0
    }

    Stop-Service -Name $serviceName -Force
    Start-Sleep -Seconds 2

    $service.Refresh()
    if ($service.Status -eq "Stopped") {
        Write-Host "[OK] Service arrete avec succes" -ForegroundColor Green
    } else {
        Write-Warning "Le service est toujours en cours d'execution"
        exit 1
    }
} catch {
    Write-Error "Erreur lors de l'arret du service: $_"
    exit 1
}
