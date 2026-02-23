# ===============================================
# NovaConnect Gateway - Script de Configuration
# ===============================================

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\Program Files\NovaConnect\Gateway",

    [Parameter(Mandatory=$false)]
    [string]$DataPath = "C:\ProgramData\NovaConnect\Gateway"
)

$envFile = Join-Path $InstallPath ".env"

if (!(Test-Path $envFile)) {
    Write-Error "Fichier .env non trouvé à: $envFile"
    exit 1
}

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  NovaConnect Gateway - Configuration                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration actuelle:" -ForegroundColor Yellow
Write-Host "Fichier: $envFile" -ForegroundColor Gray
Write-Host ""

# Afficher la configuration actuelle
$content = Get-Content $envFile
$content | ForEach-Object {
    if ($_ -match "^#") {
        Write-Host $_ -ForegroundColor DarkGray
    } elseif ($_ -match "=") {
        $parts = $_.Split("=", 2)
        $key = $parts[0]
        $value = $parts[1]

        if ($value -match "password|key|secret" -and $value.Length -gt 20) {
            Write-Host "$key=***HIDDEN***" -ForegroundColor White
        } else {
            Write-Host "$_ " -ForegroundColor White
        }
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}

Write-Host ""
$response = Read-Host "Voulez-vous modifier la configuration? (O/N)"

if ($response -eq "O" -or $response -eq "o") {
    notepad.exe $envFile

    Write-Host ""
    Write-Host "Configuration mise à jour. Redémarrez le service pour appliquer les changements:" -ForegroundColor Green
    Write-Host "  Restart-Service NovaConnectGateway" -ForegroundColor Gray
} else {
    Write-Host "Configuration inchangée" -ForegroundColor Yellow
}
