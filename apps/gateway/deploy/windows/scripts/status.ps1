# ===============================================
# NovaConnect Gateway - Script de Status
# ===============================================

$serviceName = "NovaConnectGateway"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  NovaConnect Gateway - Statut du service" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

try {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

    if (!$service) {
        Write-Error "Service '$serviceName' NON TROUVE"
        Write-Host ""
        Write-Host "Le service n'est pas installe sur ce systeme." -ForegroundColor Yellow
        Write-Host "Pour installer, executez: install.ps1" -ForegroundColor Gray
        exit 1
    }

    # Afficher le statut
    Write-Host "Service:       " -NoNewline
    switch ($service.Status) {
        "Running" { Write-Host "En cours d'execution" -ForegroundColor Green }
        "Stopped" { Write-Host "Arrete" -ForegroundColor Red }
        default { Write-Host $service.Status -ForegroundColor Yellow }
    }

    Write-Host "Start Type:    " -NoNewline
    Write-Host $service.StartType -ForegroundColor White

    Write-Host "InstallPath:   " -NoNewline
    $installPath = "C:\Program Files\NovaConnect\Gateway"
    if (Test-Path $installPath) {
        Write-Host $installPath -ForegroundColor White
    } else {
        Write-Host "Non trouve" -ForegroundColor Red
    }

    # Health check
    Write-Host ""
    Write-Host "Health Check:" -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  [OK] Gateway accessible sur http://localhost:3001" -ForegroundColor Green

            $health = $response.Content | ConvertFrom-Json
            Write-Host "  Version: $($health.gateway)" -ForegroundColor White
            Write-Host "  Status: $($health.status)" -ForegroundColor White
        }
    } catch {
        Write-Host "  [ERROR] Gateway non accessible" -ForegroundColor Red
        Write-Host "  Le service demarre peut-etre..." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Commandes utiles:" -ForegroundColor Cyan
    Write-Host "  Demarrer:   Start-Service $serviceName" -ForegroundColor Gray
    Write-Host "  Arreter:    Stop-Service $serviceName" -ForegroundColor Gray
    Write-Host "  Redemarrer: Restart-Service $serviceName" -ForegroundColor Gray
    Write-Host "  Logs:       Get-Content `"C:\ProgramData\NovaConnect\Gateway\logs\gateway.log`"" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Error "Erreur lors de la recuperation du statut: $_"
    exit 1
}
