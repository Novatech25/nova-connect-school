# ===============================================
# NovaConnect Gateway - Script de Backup
# ===============================================

param(
    [Parameter(Mandatory=$false)]
    [string]$DataPath = "C:\ProgramData\NovaConnect\Gateway",

    [Parameter(Mandatory=$false)]
    [string]$BackupPath = "$DataPath\backups"
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupPath "gateway_backup_$timestamp.zip"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  NovaConnect Gateway - Backup" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Creer le repertoire de backup si necessaire
    if (!(Test-Path $BackupPath)) {
        New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
        Write-Host "[OK] Creation du repertoire de backup: $BackupPath" -ForegroundColor Green
    }

    Write-Host "[INFO] Creation du backup en cours..." -ForegroundColor Cyan

    # Arreter le service avant le backup
    $serviceName = "NovaConnectGateway"
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    $wasRunning = $false

    if ($service -and $service.Status -eq "Running") {
        Write-Host "[WARN] Arret du service..." -ForegroundColor Yellow
        Stop-Service -Name $serviceName -Force
        Start-Sleep -Seconds 2
        $wasRunning = $true
    }

    # Creer le fichier zip
    Compress-Archive -Path $DataPath -DestinationPath $backupFile -Force

    # Redemarrer le service si necessaire
    if ($wasRunning) {
        Write-Host "[WARN] Redemarrage du service..." -ForegroundColor Yellow
        Start-Service -Name $serviceName
        Start-Sleep -Seconds 2
    }

    # Verifier le backup
    if (Test-Path $backupFile) {
        $fileSize = (Get-Item $backupFile).Length / 1MB
        Write-Host ""
        Write-Host "[OK] Backup termine avec succes !" -ForegroundColor Green
        Write-Host ""
        Write-Host "Informations du backup:" -ForegroundColor Cyan
        Write-Host "  Fichier:     $backupFile" -ForegroundColor White
        Write-Host "  Taille:      $([math]::Round($fileSize, 2)) MB" -ForegroundColor White
        Write-Host "  Date:        $(Get-Date)" -ForegroundColor White
        Write-Host ""
    } else {
        throw "Fichier de backup non cree"
    }

    # Nettoyage des vieux backups (plus de 30 jours)
    Write-Host "[INFO] Nettoyage des anciens backups..." -ForegroundColor Cyan
    $oldBackups = Get-ChildItem -Path $BackupPath -Filter "gateway_backup_*.zip" |
                  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }

    if ($oldBackups) {
        $oldBackups | ForEach-Object {
            Remove-Item $_.FullName -Force
            Write-Host "  Supprime: $($_.Name)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  Aucun vieux backup a supprimer" -ForegroundColor Gray
    }

} catch {
    Write-Host ""
    Write-Error "Erreur lors du backup: $_"
    exit 1
}
