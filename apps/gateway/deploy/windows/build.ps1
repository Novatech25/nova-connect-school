# ===============================================
# NovaConnect Gateway - Script de Build Windows
# ===============================================
# Ce script cree l'installateur Windows et les archives portables

param(
    [Parameter(Mandatory=$false)]
    [string]$Version = "1.0.0",

    [Parameter(Mandatory=$false)]
    [string]$OutputPath = ".\dist",

    [Parameter(Mandatory=$false)]
    [switch]$SkipInstaller = $false,

    [Parameter(Mandatory=$false)]
    [switch]$SkipPortable = $false,

    [Parameter(Mandatory=$false)]
    [switch]$SignExecutable = $false
)

# ===============================================
# Fonctions utilitaires
# ===============================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Magenta
    Write-Host "  $Text" -ForegroundColor Magenta
    Write-Host "====================================================" -ForegroundColor Magenta
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

# ===============================================
# Verification des prerequis
# ===============================================

function Test-BuildPrerequisites {
    Write-Header "Verification des prerequis de build"

    $allGood = $true

    # Verifier NSIS
    $nsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
    if (Test-Path $nsisPath) {
        Write-Success "NSIS trouve: $nsisPath"
    } else {
        Write-Warning "NSIS non trouve. Installateur .exe ne sera pas cree."
        Write-Info "Telechargez NSIS depuis: https://nsis.sourceforge.io/"
        $script:SkipInstaller = $true
    }

    # Verifier Git
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Success "Git trouve"
    } else {
        Write-Error "Git non trouve. Git est requis pour le build."
        $allGood = $false
    }

    # Verifier Bun
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        $bunVersion = bun --version
        Write-Success "Bun trouve (version: $bunVersion)"
    } else {
        Write-Warning "Bun non trouve. Tentative d'installation..."
        try {
            Invoke-Expression (Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -UseBasicParsing).Content
            $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
            $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
            $env:Path = "$machinePath;$userPath"
            Write-Success "Bun installe avec succes"
        } catch {
            Write-Error "Impossible d'installer Bun automatiquement"
            $allGood = $false
        }
    }

    return $allGood
}

# ===============================================
# Preparation de l'environnement de build
# ===============================================

function Initialize-BuildEnvironment {
    Write-Header "Preparation de l'environnement de build"

    # Creer le repertoire de sortie
    if (!(Test-Path $OutputPath)) {
        New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
        Write-Success "Cree: $OutputPath"
    }

    # Nettoyer les anciens builds
    Get-ChildItem -Path $OutputPath -Filter "NovaConnect-Gateway-*" | Remove-Item -Recurse -Force
    Write-Info "Anciens builds nettoyes"

    return $true
}

# ===============================================
# Build de l'installateur NSIS
# ===============================================

function Build-NSISInstaller {
    Write-Header "Build de l'installateur Windows (.exe)"

    if ($SkipInstaller) {
        Write-Warning "Build de l'installateur skippe (option -SkipInstaller)"
        return $false
    }

    try {
        $nsisScript = "gateway-installer.nsi"
        if (!(Test-Path $nsisScript)) {
            Write-Error "Script NSIS non trouve: $nsisScript"
            return $false
        }

        # Copier temporairement le fichier LICENSE pour NSIS
        # Depuis deploy/windows, remonter a la racine du projet
        $deployDir = Split-Path -Parent $PSScriptRoot
        $gatewayDir = Split-Path -Parent $deployDir
        $appsDir = Split-Path -Parent $gatewayDir
        $projectRoot = Split-Path -Parent $appsDir
        $licenseSource = Join-Path $projectRoot "LICENSE"
        $licenseTemp = ".\LICENSE.tmp"

        if (Test-Path $licenseSource) {
            Copy-Item $licenseSource $licenseTemp -Force
            Write-Info "LICENSE copie pour NSIS"
        } else {
            Write-Warning "Fichier LICENSE non trouve a: $licenseSource"
        }

        $outputFile = Join-Path $OutputPath "NovaConnect-Gateway-Setup-$Version.exe"

        Write-Info "Compilation avec NSIS..."
        $nsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"

        $arguments = @(
            "/DVERSION=$Version",
            "/DOUTPUT_FILE=$outputFile",
            $nsisScript
        )

        $process = Start-Process -FilePath $nsisPath -ArgumentList $arguments -Wait -PassThru -NoNewWindow

        # Nettoyer le fichier temporaire
        if (Test-Path $licenseTemp) {
            Remove-Item $licenseTemp -Force
        }

        if ($process.ExitCode -eq 0) {
            if (Test-Path $outputFile) {
                $fileSize = (Get-Item $outputFile).Length / 1MB
                Write-Success "Installateur cree: $outputFile ($([math]::Round($fileSize, 2)) MB)"
                return $true
            } else {
                Write-Error "Fichier de sortie non cree"
                return $false
            }
        } else {
            Write-Error "NSIS a retourne un code d'erreur: $($process.ExitCode)"
            return $false
        }
    } catch {
        Write-Error "Erreur lors du build NSIS: $_"
        return $false
    }
}

# ===============================================
# Build de l'archive portable
# ===============================================

function Build-PortableArchive {
    Write-Header "Build de l'archive portable"

    if ($SkipPortable) {
        Write-Warning "Build portable skippe (option -SkipPortable)"
        return $false
    }

    try {
        $tempDir = Join-Path $env:TEMP "NovaConnect-Gateway-Build"
        $packageDir = Join-Path $tempDir "NovaConnect-Gateway-$Version"
        $outputZip = Join-Path $OutputPath "NovaConnect-Gateway-Windows-$Version.zip"

        # Creer la structure de l'archive portable
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

        # Copier les fichiers du projet
        Write-Info "Copie des fichiers..."
        $sourceRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

        # Fichiers et dossiers a inclure
        $itemsToCopy = @(
            "src",
            "scripts",
            "package.json",
            "README.md"
        )

        foreach ($item in $itemsToCopy) {
            $sourceItem = Join-Path $sourceRoot $item
            $destItem = Join-Path $packageDir $item

            if (Test-Path $sourceItem) {
                Copy-Item -Path $sourceItem -Destination $destItem -Recurse -Force
                Write-Info "  Copie: $item"
            }
        }

        # Copier les scripts d'installation Windows
        Copy-Item -Path ".\install.ps1" -Destination $packageDir -Force
        Copy-Item -Path ".\uninstall.ps1" -Destination $packageDir -Force
        Copy-Item -Path ".\.env.example" -Destination $packageDir -Force

        # Copier les scripts de gestion
        $scriptsDest = Join-Path $packageDir "scripts"
        if (!(Test-Path $scriptsDest)) {
            New-Item -ItemType Directory -Path $scriptsDest -Force | Out-Null
        }
        Copy-Item -Path ".\scripts\*.ps1" -Destination $scriptsDest -Force

        # Creer le README portable
        $portableReadme = @"
# NovaConnect Gateway - Version $Version (Portable)

Cette version portable de NovaConnect Gateway ne necessite pas d'installation.

## Installation rapide

1. Executez le script d'installation en tant qu'administrateur:
   ```powershell
   .\install.ps1
   ```

2. Configurez le fichier .env:
   ```powershell
   notepad .env
   ```

3. Activez votre licence:
   ```powershell
   bun run activate --license VOTRE_CLE --school VOTRE_SCHOOL_ID
   ```

## Desinstallation

Executez le script de desinstallation en tant qu'administrateur:
```powershell
.\uninstall.ps1
```

## Plus d'informations

Documentation: https://docs.novaconnect.app
Support: support@novaconnect.app
"@

        $portableReadme | Out-File -FilePath (Join-Path $packageDir "README-PORTABLE.txt") -Encoding UTF8

        # Creer l'archive ZIP
        Write-Info "Creation de l'archive ZIP..."
        Compress-Archive -Path $packageDir -DestinationPath $outputZip -Force

        # Verifier l'archive
        if (Test-Path $outputZip) {
            $fileSize = (Get-Item $outputZip).Length / 1MB
            Write-Success "Archive portable creee: $outputZip ($([math]::Round($fileSize, 2)) MB)"

            # Nettoyer
            Remove-Item -Path $tempDir -Recurse -Force
            return $true
        } else {
            Write-Error "Archive non creee"
            return $false
        }
    } catch {
        Write-Error "Erreur lors de la creation de l'archive portable: $_"
        return $false
    }
}

# ===============================================
# Signature de l'executable (optionnel)
# ===============================================

function Sign-Executable {
    Write-Header "Signature de l'executable"

    if (!$SignExecutable) {
        Write-Info "Signature skippee (option -SignExecutable non activee)"
        return $false
    }

    try {
        $exeFile = Join-Path $OutputPath "NovaConnect-Gateway-Setup-$Version.exe"

        if (!(Test-Path $exeFile)) {
            Write-Warning "Aucun executable a signer"
            return $false
        }

        # Verifier si signtool est disponible
        $signtoolPath = "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe"
        $signtool = Get-ChildItem -Path $signtoolPath -ErrorAction SilentlyContinue | Select-Object -First 1

        if (!$signtool) {
            Write-Warning "signtool non trouve. Installez Windows SDK pour signer les executables."
            return $false
        }

        # Demander le certificat
        Write-Info "Certificats de signature disponibles:"
        Get-ChildItem -Path Cert:\LocalMachine\My -CodeSigningCert | Format-Table Subject, Issuer, NotBefore, NotAfter

        $certThumbprint = Read-Host "Entrez le thumbprint du certificat a utiliser"

        if (!$certThumbprint) {
            Write-Warning "Aucun certificat specifie"
            return $false
        }

        # Signer
        Write-Info "Signature de l'executable..."
        $timestampUrl = "http://timestamp.digicert.com"

        & $signtool.FullName sign /f $certThumbprint /tr $timestampUrl /td sha256 /fd sha256 $exeFile

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Executable signe avec succes"
            return $true
        } else {
            Write-Error "Echec de la signature"
            return $false
        }
    } catch {
        Write-Error "Erreur lors de la signature: $_"
        return $false
    }
}

# ===============================================
# Generation du checksum
# ===============================================

function Generate-Checksums {
    Write-Header "Generation des checksums"

    try {
        $checksumFile = Join-Path $OutputPath "checksums.txt"

        # Supprimer l'ancien fichier
        if (Test-Path $checksumFile) {
            Remove-Item $checksumFile -Force
        }

        # Calculer les checksums pour tous les fichiers
        Get-ChildItem -Path $OutputPath -File | ForEach-Object {
            $file = $_
            Write-Info "Calcul du checksum pour: $($file.Name)"

            # SHA256
            $sha256 = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash

            # Ajouter au fichier
            Add-Content -Path $checksumFile -Value "SHA256($($file.Name)) = $sha256"
        }

        Write-Success "Checksums generees: $checksumFile"
        return $true
    } catch {
        Write-Error "Erreur lors de la generation des checksums: $_"
        return $false
    }
}

# ===============================================
# Rapport de build
# ===============================================

function Show-BuildSummary {
    Write-Header "Build termine !"

    Write-Success "NovaConnect Gateway version $Version"
    Write-Host ""

    Write-Host "Fichiers generes:" -ForegroundColor Cyan

    Get-ChildItem -Path $OutputPath -File | ForEach-Object {
        $fileSize = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  * $($file.Name)" -ForegroundColor White
        Write-Host "    Taille: $fileSize MB" -ForegroundColor Gray
        Write-Host "    Chemin: $($_.FullName)" -ForegroundColor Gray
        Write-Host ""
    }

    Write-Host "Prochaines etapes:" -ForegroundColor Cyan
    Write-Host "  1. Tester l'installateur:" -ForegroundColor White
    Write-Host "     .\dist\NovaConnect-Gateway-Setup-$Version.exe" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Tester l'archive portable:" -ForegroundColor White
    Write-Host "     Extraire .\dist\NovaConnect-Gateway-Windows-$Version.zip" -ForegroundColor Gray
    Write-Host "     Executer .\install.ps1 en tant qu'admin" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Uploader sur GitHub Releases:" -ForegroundColor White
    Write-Host "     gh release create v$Version" -ForegroundColor Gray
    Write-Host "     --title `"NovaConnect Gateway v$Version`"" -ForegroundColor Gray
    Write-Host "     --notes `"Release notes here`"" -ForegroundColor Gray
    Write-Host "     dist\*" -ForegroundColor Gray
    Write-Host ""
}

# ===============================================
# Script principal
# ===============================================

function Main {
    Clear-Host

    Write-Host "====================================================" -ForegroundColor Magenta
    Write-Host "                                                        " -ForegroundColor Magenta
    Write-Host "  NovaConnect Gateway - Build Windows                  " -ForegroundColor Magenta
    Write-Host "  Version: $Version" -ForegroundColor Magenta
    Write-Host "                                                        " -ForegroundColor Magenta
    Write-Host "====================================================" -ForegroundColor Magenta
    Write-Host ""

    # Verification des prerequis
    if (!(Test-BuildPrerequisites)) {
        Write-Error "Prerequis non satisfaits. Build arrete."
        pause
        exit 1
    }

    # Initialisation
    if (!(Initialize-BuildEnvironment)) {
        Write-Error "Erreur lors de l'initialisation"
        exit 1
    }

    # Builds
    if (!$SkipInstaller) {
        $installerResult = Build-NSISInstaller
        if (!$installerResult) {
            Write-Warning "Installateur non cree (peut-etre normal si NSIS non installe)"
        }
    }

    if (!$SkipPortable) {
        $portableResult = Build-PortableArchive
        if (!$portableResult) {
            Write-Warning "Archive portable non creee"
        }
    }

    # Signature
    if ($SignExecutable) {
        Sign-Executable | Out-Null
    }

    # Checksums
    Generate-Checksums | Out-Null

    # Resume
    Show-BuildSummary

    pause
}

# Execution
Main
