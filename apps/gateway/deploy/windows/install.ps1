# ===============================================
# NovaConnect Gateway - Script d'Installation Windows
# ===============================================
# Version: 1.0.0
# Ce script installe automatiquement NovaConnect Gateway sur Windows

#Requires -RunAsAdministrator
#Requires -Version 5.1

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\Program Files\NovaConnect\Gateway",

    [Parameter(Mandatory=$false)]
    [string]$DataPath = "C:\ProgramData\NovaConnect\Gateway",

    [Parameter(Mandatory=$false)]
    [switch]$SkipBunInstall = $false,

    [Parameter(Mandatory=$false)]
    [switch]$SkipNSSMInstall = $false,

    [Parameter(Mandatory=$false)]
    [switch]$ConfigureOnly = $false
)

# ===============================================
# Fonctions utilitaires
# ===============================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Text)
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Text)
    Write-Host "[WARN] $Text" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Text)
    Write-Host "[INFO] $Text" -ForegroundColor Cyan
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ScriptDirectory {
    $scriptPath = $PSScriptRoot
    if ($scriptPath) {
        return $scriptPath
    }
    # Si execute directement, utiliser le repertoire courant
    return (Get-Location).Path
}

# ===============================================
# Verification des prerequis
# ===============================================

function Test-Prerequisites {
    Write-Header "Verification des prerequis"

    # Verifier Windows version
    $osVersion = [Environment]::OSVersion.Version
    $osName = (Get-CimInstance -ClassName Win32_OperatingSystem).Caption

    Write-Info "Systeme d'exploitation: $osName"
    Write-Info "Version: $($osVersion.Major).$($osVersion.Minor)"

    if ($osVersion.Major -lt 10) {
        Write-Error "Windows 10/11 est requis"
        return $false
    }

    # Verifier architecture
    $arch = [System.Environment]::GetEnvironmentVariable("PROCESSOR_ARCHITECTURE")
    if ($arch -ne "AMD64") {
        Write-Error "Architecture 64-bit requise (actuelle: $arch)"
        return $false
    }
    Write-Success "Architecture 64-bit OK"

    # Verifier RAM
    $ram = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1GB
    Write-Info "RAM totale: $([math]::Round($ram, 2)) GB"
    if ($ram -lt 4) {
        Write-Warning "Moins de 4GB de RAM detectes (recommande: 8GB)"
    } else {
        Write-Success "RAM suffisante"
    }

    # Verifier espace disque
    $drive = (Get-Item $InstallPath).PSDrive
    $freeSpace = $drive.Free / 1GB
    Write-Info "Espace libre sur $($drive.Name): $([math]::Round($freeSpace, 2)) GB"
    if ($freeSpace -lt 10) {
        Write-Warning "Moins de 10GB d'espace libre (recommande: 20GB)"
    } else {
        Write-Success "Espace disque suffisant"
    }

    return $true
}

# ===============================================
# Installation de Bun
# ===============================================

function Install-BunRuntime {
    Write-Header "Installation de Bun Runtime"

    if (Get-Command bun -ErrorAction SilentlyContinue) {
        $bunVersion = bun --version
        Write-Success "Bun est deja installe (version: $bunVersion)"
        return $true
    }

    Write-Info "Telechargement et installation de Bun..."
    try {
        $installScript = Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -UseBasicParsing
        Invoke-Expression $installScript.Content

        # Rafraichir les variables d'environnement
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        if (Get-Command bun -ErrorAction SilentlyContinue) {
            $bunVersion = bun --version
            Write-Success "Bun installe avec succes (version: $bunVersion)"
            return $true
        } else {
            Write-Error "Echec de l'installation de Bun"
            return $false
        }
    } catch {
        Write-Error "Erreur lors de l'installation de Bun: $_"
        return $false
    }
}

# ===============================================
# Installation de NSSM
# ===============================================

function Install-NSSM {
    Write-Header "Installation de NSSM (Service Manager)"

    if (Get-Command nssm -ErrorAction SilentlyContinue) {
        Write-Success "NSSM est deja installe"
        return $true
    }

    Write-Info "Telechargement de NSSM..."
    try {
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $nssmZip = "$env:TEMP\nssm.zip"
        $nssmExtractPath = "$env:TEMP\nssm"

        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
        Expand-Archive -Path $nssmZip -DestinationPath $nssmExtractPath -Force

        # Copier nssm.exe dans System32
        $nssmPath = Get-ChildItem -Path $nssmExtractPath -Recurse -Filter "nssm.exe" | Select-Object -First 1
        Copy-Item $nssmPath.FullName -Destination "C:\Windows\System32\nssm.exe" -Force

        # Nettoyer
        Remove-Item $nssmZip -Force
        Remove-Item $nssmExtractPath -Recurse -Force

        Write-Success "NSSM installe avec succes"
        return $true
    } catch {
        Write-Error "Erreur lors de l'installation de NSSM: $_"
        return $false
    }
}

# ===============================================
# Creation des repertoire
# ===============================================

function Initialize-Directories {
    Write-Header "Creation des repertoire"

    $directories = @(
        $InstallPath,
        "$DataPath\data",
        "$DataPath\logs",
        "$DataPath\backups",
        "$DataPath\temp"
    )

    foreach ($dir in $directories) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Success "Cree: $dir"
        } else {
            Write-Info "Existe deja: $dir"
        }
    }

    return $true
}

# ===============================================
# Copie des fichiers
# ===============================================

function Copy-ProjectFiles {
    Write-Header "Copie des fichiers du projet"

    $scriptDir = Get-ScriptDirectory
    $sourcePath = Split-Path -Path $scriptDir -Parent

    # Fichiers a copier
    $filesToCopy = @(
        "src",
        "scripts",
        "package.json",
        "README.md",
        ".gitignore"
    )

    foreach ($file in $filesToCopy) {
        $sourceFile = Join-Path $sourcePath $file
        $destFile = Join-Path $InstallPath $file

        if (Test-Path $sourceFile) {
            Copy-Item -Path $sourceFile -Destination $destFile -Recurse -Force
            Write-Success "Copie: $file"
        } else {
            Write-Warning "Non trouve: $file"
        }
    }

    # Copier le fichier .env.example
    $envExample = Join-Path $scriptDir ".env.example"
    $envDest = Join-Path $InstallPath ".env.example"
    if (Test-Path $envExample) {
        Copy-Item -Path $envExample -Destination $envDest -Force
        Write-Success "Copie: .env.example"
    }

    return $true
}

# ===============================================
# Installation des dependances
# ===============================================

function Install-Dependencies {
    Write-Header "Installation des dependances Bun"

    try {
        Push-Location $InstallPath
        bun install
        Pop-Location
        Write-Success "Dependance installees avec succes"
        return $true
    } catch {
        Write-Error "Erreur lors de l'installation des dependances: $_"
        return $false
    }
}

# ===============================================
# Configuration du pare-feu
# ===============================================

function Configure-Firewall {
    Write-Header "Configuration du pare-feu Windows"

    try {
        # Supprimer l'ancienne regle si elle existe
        $existingRule = Get-NetFirewallRule -DisplayName "NovaConnect Gateway" -ErrorAction SilentlyContinue
        if ($existingRule) {
            Remove-NetFirewallRule -DisplayName "NovaConnect Gateway" -Confirm:$false
            Write-Info "Ancienne regle de pare-feu supprimee"
        }

        # Ajouter la nouvelle regle
        New-NetFirewallRule -DisplayName "NovaConnect Gateway" `
            -Direction Inbound `
            -LocalPort 3001 `
            -Protocol TCP `
            -Action Allow `
            -Description "NovaConnect Gateway - API Server" `
            -Profile Domain,Public,Private | Out-Null

        Write-Success "Regle de pare-feu ajoutee pour le port 3001"
        return $true
    } catch {
        Write-Error "Erreur lors de la configuration du pare-feu: $_"
        return $false
    }
}

# ===============================================
# Creation du service Windows
# ===============================================

function Install-WindowsService {
    Write-Header "Creation du service Windows"

    try {
        # Verifier si Bun est installe
        $bunPath = where.exe bun
        if (!$bunPath) {
            Write-Error "Bun non trouve. Veuillez reessayer ou installer Bun manuellement."
            return $false
        }

        # Supprimer l'ancien service si il existe
        $existingService = Get-Service -Name "NovaConnectGateway" -ErrorAction SilentlyContinue
        if ($existingService) {
            Write-Info "Arret et suppression de l'ancien service..."
            Stop-Service -Name "NovaConnectGateway" -Force -ErrorAction SilentlyContinue
            nssm remove NovaConnectGateway confirm
            Start-Sleep -Seconds 2
        }

        # Creer le service avec NSSM
        nssm install NovaConnectGateway $bunPath "run start"
        nssm set NovaConnectGateway AppDirectory $InstallPath
        nssm set NovaConnectGateway DisplayName "NovaConnect Gateway"
        nssm set NovaConnectGateway Description "NovaConnect Gateway - Mode hors ligne pour ecoles"
        nssm set NovaConnectGateway Start SERVICE_AUTO_START

        # Variables d'environnement du service
        nssm set NovaConnectGateway AppEnvironmentExtra "NODE_ENV=production" "PORT=3001"

        # Redirection des logs
        nssm set NovaConnectGateway AppStdout "$DataPath\logs\stdout.log"
        nssm set NovaConnectGateway AppStderr "$DataPath\logs\stderr.log"
        nssm set NovaConnectGateway AppRotateFiles 1
        nssm set NovaConnectGateway AppRotateBytes 10485760

        # Redemarrage automatique
        nssm set NovaConnectGateway AppExit Default Restart
        nssm set NovaConnectGateway AppRestartDelay 10000
        nssm set NovaConnectGateway AppThrottle 1500

        # Dependencies
        nssm set NovaConnectGateway DependOnService Tcpip

        Write-Success "Service Windows cree avec succes"
        return $true
    } catch {
        Write-Error "Erreur lors de la creation du service: $_"
        return $false
    }
}

# ===============================================
# Configuration initiale
# ===============================================

function Initialize-Configuration {
    Write-Header "Configuration initiale"

    $envFile = Join-Path $InstallPath ".env"

    # Creer le fichier .env s'il n'existe pas
    if (!(Test-Path $envFile)) {
        Copy-Item (Join-Path $InstallPath ".env.example") $envFile
        Write-Info "Fichier .env cree"
    }

    # Verifier si la configuration est complete
    $envContent = Get-Content $envFile -Raw
    $missingConfig = $false

    $requiredFields = @(
        "SCHOOL_ID",
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_KEY"
    )

    foreach ($field in $requiredFields) {
        if ($envContent -match "$field=\s*$") {
            Write-Warning "Configuration manquante: $field"
            $missingConfig = $true
        }
    }

    if ($missingConfig) {
        Write-Warning ""
        Write-Warning "Configuration incomplete detectee !"
        Write-Info "Veuillez editer le fichier: $envFile"
        Write-Info "Ou utiliser l'utilitaire de configuration:"
        Write-Info "  powershell -File `"$InstallPath\scripts\configure.ps1`""
        Write-Warning ""
        $response = Read-Host "Voulez-vous configurer maintenant? (O/N)"
        if ($response -eq "O" -or $response -eq "o") {
            & "$InstallPath\scripts\configure.ps1"
        }
    } else {
        Write-Success "Configuration complete"
    }

    return $true
}

# ===============================================
# Installation des scripts de gestion
# ===============================================

function Install-ManagementScripts {
    Write-Header "Installation des scripts de gestion"

    $scriptsDir = Join-Path $InstallPath "scripts"
    $deployScriptsDir = Join-Path (Get-ScriptDirectory) "scripts"

    if (!(Test-Path $scriptsDir)) {
        New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
    }

    # Copier les scripts depuis deploy/windows/scripts
    if (Test-Path $deployScriptsDir) {
        Copy-Item -Path "$deployScriptsDir\*.ps1" -Destination $scriptsDir -Force
        Write-Success "Scripts de gestion installes"
    }

    return $true
}

# ===============================================
# Raccourcis menu Demarrer
# ===============================================

function Install-StartMenuShortcuts {
    Write-Header "Creation des raccourcis menu Demarrer"

    try {
        $startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\NovaConnect Gateway"
        if (!(Test-Path $startMenuPath)) {
            New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
        }

        $WshShell = New-Object -ComObject WScript.Shell

        # Raccourci vers l'interface web
        $shortcut = $WshShell.CreateShortcut("$startMenuPath\NovaConnect Gateway Admin.lnk")
        $shortcut.TargetPath = "http://localhost:3001/admin"
        $shortcut.Description = "Interface d'administration NovaConnect Gateway"
        $shortcut.Save()

        # Raccourci vers le dossier
        $shortcut = $WshShell.CreateShortcut("$startMenuPath\Ouvrir le dossier d'installation.lnk")
        $shortcut.TargetPath = $InstallPath
        $shortcut.Description = "Ouvrir le dossier d'installation"
        $shortcut.Save()

        Write-Success "Raccourcis menu Demarrer crees"
        return $true
    } catch {
        Write-Error "Erreur lors de la creation des raccourcis: $_"
        return $false
    }
}

# ===============================================
# Installation et demarrage du service
# ===============================================

function Start-GatewayService {
    Write-Header "Demarrage du service"

    try {
        nssm start NovaConnectGateway
        Start-Sleep -Seconds 3

        $service = Get-Service -Name "NovaConnectGateway" -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq "Running") {
            Write-Success "Service demarre avec succes"
            return $true
        } else {
            Write-Warning "Service installe mais non demarre. Verifiez les logs."
            return $false
        }
    } catch {
        Write-Error "Erreur lors du demarrage du service: $_"
        return $false
    }
}

# ===============================================
# Health check
# ===============================================

function Test-HealthCheck {
    Write-Header "Verification du deploiement"

    Start-Sleep -Seconds 2

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Health check reussi !"
            Write-Info "Le Gateway est accessible sur: http://localhost:3001"
            Write-Info "Interface admin: http://localhost:3001/admin"
            return $true
        } else {
            Write-Warning "Health check a retourne un code: $($response.StatusCode)"
            return $false
        }
    } catch {
        Write-Warning "Health check echoue: $_"
        Write-Info "Le service demarre peut-etre encore. Verifiez dans quelques instants."
        return $false
    }
}

# ===============================================
# Affichage du resume
# ===============================================

function Show-Summary {
    Write-Header "Installation terminee !"

    Write-Success "NovaConnect Gateway a ete installe avec succes"
    Write-Host ""
    Write-Host "Informations d'installation:" -ForegroundColor Cyan
    Write-Host "   Repertoire: $InstallPath" -ForegroundColor White
    Write-Host "   Donnees:   $DataPath" -ForegroundColor White
    Write-Host "   Service:   NovaConnectGateway" -ForegroundColor White
    Write-Host "   Port:      3001" -ForegroundColor White
    Write-Host ""
    Write-Host "Acces:" -ForegroundColor Cyan
    Write-Host "   API:      http://localhost:3001" -ForegroundColor White
    Write-Host "   Admin:    http://localhost:3001/admin" -ForegroundColor White
    Write-Host "   Health:   http://localhost:3001/health" -ForegroundColor White
    Write-Host ""
    Write-Host "Gestion du service:" -ForegroundColor Cyan
    Write-Host "   Demarrer:   Start-Service NovaConnectGateway" -ForegroundColor White
    Write-Host "   Arreter:    Stop-Service NovaConnectGateway" -ForegroundColor White
    Write-Host "   Redemarrer: Restart-Service NovaConnectGateway" -ForegroundColor White
    Write-Host "   Statut:     Get-Service NovaConnectGateway" -ForegroundColor White
    Write-Host ""
    Write-Host "Prochaines etapes:" -ForegroundColor Cyan
    Write-Host "   1. Configurez le fichier .env si ce n'est pas deja fait:" -ForegroundColor White
    Write-Host "      notepad $InstallPath\.env" -ForegroundColor Gray
    Write-Host "   2. Activez votre licence:" -ForegroundColor White
    Write-Host "      cd $InstallPath" -ForegroundColor Gray
    Write-Host "      bun run activate --license VOTRE_CLE --school VOTRE_SCHOOL_ID" -ForegroundColor Gray
    Write-Host "   3. Configurez l'IP statique (recommande)" -ForegroundColor White
    Write-Host ""
    Write-Host "Documentation:" -ForegroundColor Cyan
    Write-Host "   $InstallPath\README.md" -ForegroundColor White
    Write-Host ""
}

# ===============================================
# Script principal
# ===============================================

function Main {
    Clear-Host

    Write-Header "NovaConnect Gateway - Installation Windows"
    Write-Host "Version 1.0.0" -ForegroundColor Gray
    Write-Host ""

    # Verifier les droits administrateur
    if (!(Test-Administrator)) {
        Write-Error "Ce script doit etre execute en tant qu'administrateur"
        Write-Info "Clic droit sur PowerShell -> Executer en tant qu'administrateur"
        pause
        exit 1
    }

    # Confirmation
    Write-Warning "Cette action va installer NovaConnect Gateway sur ce systeme."
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  Repertoire d'installation: $InstallPath" -ForegroundColor White
    Write-Host "  Repertoire des donnees:    $DataPath" -ForegroundColor White
    Write-Host ""
    $response = Read-Host "Continuer? (O/N)"
    if ($response -ne "O" -and $response -ne "o") {
        Write-Info "Installation annulee"
        exit 0
    }

    # Execution des etapes
    $steps = @(
        @{ Name = "Verification des prerequis"; Function = "Test-Prerequisites" },
        @{ Name = "Installation de Bun"; Function = "Install-BunRuntime"; Skip = $SkipBunInstall },
        @{ Name = "Installation de NSSM"; Function = "Install-NSSM"; Skip = $SkipNSSMInstall },
        @{ Name = "Creation des repertoire"; Function = "Initialize-Directories" },
        @{ Name = "Copie des fichiers"; Function = "Copy-ProjectFiles"; Skip = $ConfigureOnly },
        @{ Name = "Installation des dependances"; Function = "Install-Dependencies"; Skip = $ConfigureOnly },
        @{ Name = "Installation des scripts"; Function = "Install-ManagementScripts"; Skip = $ConfigureOnly },
        @{ Name = "Configuration du pare-feu"; Function = "Configure-Firewall" },
        @{ Name = "Creation du service"; Function = "Install-WindowsService" },
        @{ Name = "Configuration initiale"; Function = "Initialize-Configuration" },
        @{ Name = "Raccourcis menu Demarrer"; Function = "Install-StartMenuShortcuts" }
    )

    foreach ($step in $steps) {
        if ($step.Skip -and $step.Skip -eq $true) {
            Write-Info "$($step.Name) - Ignore"
            continue
        }

        $result = & $step.Function
        if (!$result) {
            Write-Error "Echec a l'etape: $($step.Name)"
            Write-Host ""
            Write-Warning "Installation arretee. Veuillez corriger l'erreur et reessayer."
            pause
            exit 1
        }
    }

    # Demarrer le service
    if (Start-GatewayService) {
        Start-Sleep -Seconds 3
        Test-HealthCheck
    }

    Show-Summary
    pause
}

# Execution
Main
