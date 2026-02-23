# ===============================================
# NovaConnect Gateway - Script d'Installation du Service
# ===============================================
# Ce script est appele par install.ps1 ou NSIS pour creer le service Windows

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\Program Files\NovaConnect\Gateway",

    [Parameter(Mandatory=$false)]
    [string]$DataPath = "C:\ProgramData\NovaConnect\Gateway"
)

# ===============================================
# Fonctions
# ===============================================

function Write-Info {
    param([string]$Text)
    Write-Host "[INFO] $Text" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

# ===============================================
# Main
# ===============================================

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  NovaConnect Gateway - Installation Service Windows" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Verifier si NSSM est installe
    $nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
    if (!$nssmPath) {
        Write-Error "NSSM n'est pas installe"
        Write-Info "Telechargez NSSM depuis: https://nssm.cc/download"
        exit 1
    }
    Write-Success "NSSM trouve: $($nssmPath.Source)"

    # Verifier si Bun est installe
    $bunPath = where.exe bun
    if (!$bunPath) {
        Write-Error "Bun n'est pas installe"
        exit 1
    }
    Write-Success "Bun trouve: $bunPath"

    # Supprimer l'ancien service si existe
    $existingService = Get-Service -Name "NovaConnectGateway" -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Info "Arret de l'ancien service..."
        Stop-Service -Name "NovaConnectGateway" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        Write-Info "Suppression de l'ancien service..."
        nssm remove NovaConnectGateway confirm 2>&1 | Out-Null
    }

    # Creer le service
    Write-Info "Creation du service Windows..."
    nssm install NovaConnectGateway $bunPath "run start"

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Echec de la creation du service (code: $LASTEXITCODE)"
        exit 1
    }

    # Configurer le service
    Write-Info "Configuration du service..."

    nssm set NovaConnectGateway AppDirectory $InstallPath
    nssm set NovaConnectGateway DisplayName "NovaConnect Gateway"
    nssm set NovaConnectGateway Description "NovaConnect Gateway - Mode hors ligne pour ecoles"
    nssm set NovaConnectGateway Start SERVICE_AUTO_START

    # Variables d'environnement
    nssm set NovaConnectGateway AppEnvironmentExtra "NODE_ENV=production" "PORT=3001"

    # Redirection des logs
    nssm set NovaConnectGateway AppStdout "$DataPath\logs\stdout.log"
    nssm set NovaConnectGateway AppStderr "$DataPath\logs\stderr.log"
    nssm set NovaConnectGateway AppRotateFiles 1
    nssm set NovaConnectGateway AppRotateBytes 10485760

    # Redemarrage automatique en cas d'echec
    nssm set NovaConnectGateway AppExit Default Restart
    nssm set NovaConnectGateway AppRestartDelay 10000
    nssm set NovaConnectGateway AppThrottle 1500

    # Dependencies
    nssm set NovaConnectGateway DependOnService Tcpip

    Write-Success "Service cree avec succes"

    # Demarrer le service
    Write-Info "Demarrage du service..."
    nssm start NovaConnectGateway

    Start-Sleep -Seconds 3

    # Verifier le statut
    $service = Get-Service -Name "NovaConnectGateway" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-Success "Service demarre avec succes"

        # Health check
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Success "Health check reussi !"
                Write-Info "Gateway accessible sur: http://localhost:3001"
            }
        } catch {
            Write-Info "Le service demarre, health check echoue (normal au premier demarrage)"
        }

        Write-Host ""
        Write-Host "Installation terminee !" -ForegroundColor Green
        Write-Host ""
        Write-Host "Commandes utiles:" -ForegroundColor Cyan
        Write-Host "  Statut:   Get-Service NovaConnectGateway" -ForegroundColor Gray
        Write-Host "  Demarrer: Start-Service NovaConnectGateway" -ForegroundColor Gray
        Write-Host "  Arreter:  Stop-Service NovaConnectGateway" -ForegroundColor Gray
        Write-Host "  Logs:     Get-Content `"$DataPath\logs\gateway.log`"" -ForegroundColor Gray
        Write-Host ""

        exit 0
    } else {
        Write-Error "Le service n'a pas pu demarrer"
        Write-Info "Verifiez les logs dans: $DataPath\logs"
        exit 1
    }

} catch {
    Write-Error "Erreur lors de l'installation: $_"
    exit 1
}
