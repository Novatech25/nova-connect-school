# ===============================================
# NovaConnect Gateway - Script de Désinstallation Windows
# ===============================================
# Version: 1.0.0
# Ce script désinstalle NovaConnect Gateway de Windows

#Requires -RunAsAdministrator
#Requires -Version 5.1

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\Program Files\NovaConnect\Gateway",

    [Parameter(Mandatory=$false)]
    [string]$DataPath = "C:\ProgramData\NovaConnect\Gateway",

    [Parameter(Mandatory=$false)]
    [switch]$KeepData = $false,

    [Parameter(Mandatory=$false)]
    [switch]$Force = $false
)

# ===============================================
# Fonctions utilitaires
# ===============================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║  $Text" -ForegroundColor Red
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠️  $Text" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ️  $Text" -ForegroundColor Cyan
}

# ===============================================
# Confirmation
# ===============================================

function Confirm-Uninstallation {
    Write-Header "Désinstallation de NovaConnect Gateway"

    Write-Warning "ATTENTION: Cette action va désinstaller NovaConnect Gateway"
    Write-Host ""
    Write-Host "Les éléments suivants seront supprimés:" -ForegroundColor Red
    Write-Host "  • Service Windows NovaConnectGateway" -ForegroundColor White
    Write-Host "  • Fichiers de programme: $InstallPath" -ForegroundColor White

    if (!$KeepData) {
        Write-Host "  • Données et configuration: $DataPath" -ForegroundColor Red
    } else {
        Write-Host "  • Données conservées dans: $DataPath" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Les éléments suivants seront conservés:" -ForegroundColor Green
    Write-Host "  • Règles de pare-feu" -ForegroundColor White
    Write-Host "  • Logs dans l'observateur d'événements Windows" -ForegroundColor White
    Write-Host ""

    if (!$Force) {
        $response = Read-Host "Êtes-vous sûr de vouloir continuer? (O/N)"
        if ($response -ne "O" -and $response -ne "o") {
            Write-Info "Désinstallation annulée"
            exit 0
        }
    }
}

# ===============================================
# Arrêt et suppression du service
# ===============================================

function Remove-Service {
    Write-Header "Suppression du service Windows"

    try {
        $service = Get-Service -Name "NovaConnectGateway" -ErrorAction SilentlyContinue

        if ($service) {
            Write-Info "Arrêt du service..."
            Stop-Service -Name "NovaConnectGateway" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2

            Write-Info "Suppression du service avec NSSM..."
            $nssmOutput = nssm remove NovaConnectGateway confirm 2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Service supprimé avec succès"
            } else {
                Write-Warning "NSSM n'a pas pu supprimer le service, tentative via sc.exe..."
                sc.exe delete NovaConnectGateway | Out-Null
                Write-Success "Service supprimé via sc.exe"
            }
        } else {
            Write-Info "Aucun service trouvé"
        }

        return $true
    } catch {
        Write-Error "Erreur lors de la suppression du service: $_"
        return $false
    }
}

# ===============================================
# Suppression des raccourcis
# ===============================================

function Remove-Shortcuts {
    Write-Header "Suppression des raccourcis"

    try {
        $startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\NovaConnect Gateway"

        if (Test-Path $startMenuPath) {
            Remove-Item -Path $startMenuPath -Recurse -Force
            Write-Success "Raccourcis menu Démarrer supprimés"
        } else {
            Write-Info "Aucun raccourci trouvé"
        }

        return $true
    } catch {
        Write-Error "Erreur lors de la suppression des raccourcis: $_"
        return $false
    }
}

# ===============================================
# Suppression des fichiers de programme
# ===============================================

function Remove-ProgramFiles {
    Write-Header "Suppression des fichiers de programme"

    if (!(Test-Path $InstallPath)) {
        Write-Info "Répertoire d'installation non trouvé: $InstallPath"
        return $true
    }

    try {
        # Essayer de supprimer les fichiers verrouillés
        Write-Info "Tentative de suppression des fichiers..."
        Remove-Item -Path $InstallPath -Recurse -Force -ErrorAction Stop

        Write-Success "Fichiers de programme supprimés"
        return $true
    } catch {
        Write-Warning "Certains fichiers sont toujours utilisés"
        Write-Info "Les fichiers seront supprimés au prochain redémarrage"

        try {
            # Planifier la suppression pour le prochain démarrage
            $cmd = "cmd /c rd /s /q `"$InstallPath`""
            reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\RunOnce" `
                /v "DeleteNovaConnectGateway" `
                /t REG_SZ `
                /d $cmd `
                /f | Out-Null

            Write-Success "Suppression planifiée au prochain démarrage"
            return $true
        } catch {
            Write-Error "Impossible de planifier la suppression: $_"
            Write-Info "Veuillez supprimer manuellement: $InstallPath"
            return $false
        }
    }
}

# ===============================================
# Suppression des données
# ===============================================

function Remove-Data {
    Write-Header "Suppression des données"

    if ($KeepData) {
        Write-Warning "Conservation des données (option -KeepData activée)"
        Write-Info "Données conservées dans: $DataPath"
        return $true
    }

    if (!(Test-Path $DataPath)) {
        Write-Info "Aucune donnée trouvée à: $DataPath"
        return $true
    }

    Write-Warning "Suppression de toutes les données dans: $DataPath"
    $response = Read-Host "Confirmer la suppression des données? (O/N)"

    if ($response -eq "O" -or $response -eq "o") {
        try {
            Remove-Item -Path $DataPath -Recurse -Force
            Write-Success "Données supprimées"
            return $true
        } catch {
            Write-Error "Erreur lors de la suppression des données: $_"
            Write-Info "Veuillez supprimer manuellement: $DataPath"
            return $false
        }
    } else {
        Write-Info "Données conservées dans: $DataPath"
        return $true
    }
}

# ===============================================
# Nettoyage du registre
# ===============================================

function Remove-RegistryEntries {
    Write-Header "Nettoyage du registre"

    try {
        # Supprimer les entrées RunOnce si elles existent
        $runOnceKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
        $entry = Get-ItemProperty -Path $runOnceKey -Name "DeleteNovaConnectGateway" -ErrorAction SilentlyContinue

        if ($entry) {
            Remove-ItemProperty -Path $runOnceKey -Name "DeleteNovaConnectGateway" -Force
            Write-Success "Entrée RunOnce supprimée"
        } else {
            Write-Info "Aucune entrée de registre trouvée"
        }

        return $true
    } catch {
        Write-Error "Erreur lors du nettoyage du registre: $_"
        return $false
    }
}

# ===============================================
# Rapport de désinstallation
# ===============================================

function Show-UninstallReport {
    Write-Header "Désinstallation terminée"

    Write-Success "NovaConnect Gateway a été désinstallé"
    Write-Host ""
    Write-Host "📝 Éléments supprimés:" -ForegroundColor Cyan
    Write-Host "   ✓ Service Windows" -ForegroundColor White
    Write-Host "   ✓ Raccourcis menu Démarrer" -ForegroundColor White
    Write-Host "   ✓ Fichiers de programme" -ForegroundColor White

    if (!$KeepData) {
        Write-Host "   ✓ Données et configuration" -ForegroundColor White
    } else {
        Write-Host "   ✗ Données conservées dans: $DataPath" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "📋 Éléments conservés (à nettoyer manuellement si souhaité):" -ForegroundColor Cyan
    Write-Host "   • Règle de pare-feu: NovaConnect Gateway" -ForegroundColor White
    Write-Host "   • Observateur d'événements Windows" -ForegroundColor White

    Write-Host ""
    Write-Host "Pour supprimer la règle de pare-feu:" -ForegroundColor Yellow
    Write-Host "   Remove-NetFirewallRule -DisplayName 'NovaConnect Gateway'" -ForegroundColor Gray
    Write-Host ""
}

# ===============================================
# Script principal
# ===============================================

function Main {
    Clear-Host

    # Vérifier les droits administrateur
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (!$isAdmin) {
        Write-Error "Ce script doit être exécuté en tant qu'administrateur"
        Write-Info "Clic droit sur PowerShell -> Exécuter en tant qu'administrateur"
        pause
        exit 1
    }

    # Confirmation
    Confirm-Uninstallation

    # Exécution des étapes
    $steps = @(
        @{ Name = "Suppression du service"; Function = "Remove-Service" },
        @{ Name = "Suppression des raccourcis"; Function = "Remove-Shortcuts" },
        @{ Name = "Suppression des fichiers"; Function = "Remove-ProgramFiles" },
        @{ Name = "Suppression des données"; Function = "Remove-Data" },
        @{ Name = "Nettoyage du registre"; Function = "Remove-RegistryEntries" }
    )

    foreach ($step in $steps) {
        $result = & $step.Function
        if (!$result) {
            Write-Error "Erreur lors de: $($step.Name)"
        }
    }

    Show-UninstallReport
    pause
}

# Exécution
Main
