# ===============================================
# NovaConnect Gateway - Script de Start
# ===============================================

$serviceName = "NovaConnectGateway"

Write-Host "Demarrage de NovaConnect Gateway..." -ForegroundColor Cyan

try {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if (!$service) {
        Write-Error "Service '$serviceName' non trouve"
        Write-Host "Le service n'est peut-etre pas installe." -ForegroundColor Yellow
        exit 1
    }

    if ($service.Status -eq "Running") {
        Write-Host "Le service est deja en cours d'execution" -ForegroundColor Green
        exit 0
    }

    Start-Service -Name $serviceName
    Start-Sleep -Seconds 3

    $service.Refresh()
    if ($service.Status -eq "Running") {
        Write-Host "[OK] Service demarre avec succes" -ForegroundColor Green
        Write-Host ""
        Write-Host "Acces:" -ForegroundColor Cyan
        Write-Host "  API:   http://localhost:3001" -ForegroundColor White
        Write-Host "  Admin: http://localhost:3001/admin" -ForegroundColor White
    } else {
        Write-Error "Le service n'a pas pu demarrer"
        Write-Host "Verifiez les logs dans: C:\ProgramData\NovaConnect\Gateway\logs" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Error "Erreur lors du demarrage du service: $_"
    exit 1
}
