# NovaConnect Gateway - Installation Windows

Ce dossier contient tous les fichiers nécessaires pour créer et déployer l'installateur Windows de NovaConnect Gateway.

## 📋 Structure

```
deploy/windows/
├── .env.example              # Template de configuration
├── install.ps1              # Script d'installation PowerShell
├── uninstall.ps1            # Script de désinstallation PowerShell
├── build.ps1                # Script de création de l'installateur
├── gateway-installer.nsi    # Configuration NSIS (installateur .exe)
├── README.md                # Ce fichier
└── scripts/
    ├── configure.ps1        # Configuration interactive
    ├── start.ps1            # Démarrer le service
    ├── stop.ps1             # Arrêter le service
    ├── status.ps1           # Vérifier le statut
    └── backup.ps1           # Créer une sauvegarde
```

## 🚀 Méthodes d'installation

### Option 1: Installateur automatisé (.exe) ⭐ Recommandé

L'installateur Windows fournit une interface graphique conviviale pour installer NovaConnect Gateway.

**Pour créer l'installateur:**

```powershell
# À la racine du projet
cd apps/gateway/deploy/windows

# Exécuter le script de build
.\build.ps1 -Version "1.0.0"

# L'installateur sera créé dans: .\dist\NovaConnect-Gateway-Setup-1.0.0.exe
```

**Pour utiliser l'installateur:**

1. Double-cliquer sur `NovaConnect-Gateway-Setup-1.0.0.exe`
2. Suivre l'assistant d'installation
3. Configurer les identifiants Supabase
4. Le service Windows sera créé et démarré automatiquement

### Option 2: Script PowerShell (Installateur Automatisé)

Installation via script PowerShell sans interface graphique.

```powershell
# Ouvrir PowerShell en tant qu'administrateur
cd apps/gateway/deploy/windows

# Exécuter l'installation
.\install.ps1

# Options avancées:
.\install.ps1 -InstallPath "C:\NovaConnect\Gateway" -DataPath "C:\ProgramData\NovaConnect"
```

### Option 3: Archive portable (sans installation)

Pour une installation portable sans service Windows.

```powershell
# Créer l'archive portable
.\build.ps1 -Version "1.0.0" -SkipInstaller

# Extraire l'archive
Expand-Archive .\dist\NovaConnect-Gateway-Windows-1.0.0.zip -DestinationPath C:\NovaConnect\Gateway

# Exécuter en mode console
cd C:\NovaConnect\Gateway
bun run start
```

## 📦 Création de l'installateur

### Prérequis

```powershell
# 1. Installer NSIS (pour créer le .exe)
# Télécharger depuis: https://nsis.sourceforge.io/

# 2. Vérifier l'installation
makensis /VERSION

# 3. (Optionnel) Installer un certificat de signature
# Pour signer l'exécutable
```

### Build complet

```powershell
# Build complet avec tous les artefacts
.\build.ps1 -Version "1.0.0"

# Cela crée:
# - dist/NovaConnect-Gateway-Setup-1.0.0.exe   (Installateur)
# - dist/NovaConnect-Gateway-Windows-1.0.0.zip (Portable)
# - dist/checksums.txt                         (Checksums SHA256)
```

### Options de build

```powershell
# Installer uniquement
.\build.ps1 -Version "1.0.0" -SkipPortable

# Portable uniquement
.\build.ps1 -Version "1.0.0" -SkipInstaller

# Signer l'exécutable (nécessite un certificat)
.\build.ps1 -Version "1.0.0" -SignExecutable

# Spécifier le répertoire de sortie
.\build.ps1 -Version "1.0.0" -OutputPath "..\releases"
```

## 🔧 Gestion du service

Une fois installé, le service peut être géré avec:

### Scripts PowerShell

```powershell
# Vérifier le statut
.\scripts\status.ps1

# Démarrer le service
.\scripts\start.ps1

# Arrêter le service
.\scripts\stop.ps1

# Configurer
.\scripts\configure.ps1

# Backup
.\scripts\backup.ps1
```

### Commandes natives Windows

```powershell
# Via PowerShell ou CMD
Start-Service NovaConnectGateway
Stop-Service NovaConnectGateway
Restart-Service NovaConnectGateway
Get-Service NovaConnectGateway

# Via NSSM (plus d'options)
nssm start NovaConnectGateway
nssm stop NovaConnectGateway
nssm restart NovaConnectGateway
nssm status NovaConnectGateway
```

## 📝 Configuration

Le fichier de configuration est situé dans:

```
C:\ProgramData\NovaConnect\Gateway\.env
```

**Pour configurer:**

```powershell
# Option 1: Script interactif
.\scripts\configure.ps1

# Option 2: Notepad
notepad C:\ProgramData\NovaConnect\Gateway\.env

# Option 3: VS Code
code C:\ProgramData\NovaConnect\Gateway\.env
```

**Variables requises:**

```env
SCHOOL_ID=votre-ecole-uuid-ici
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

## 🔐 Activation de la licence

```powershell
# Naviguer vers le répertoire d'installation
cd "C:\Program Files\NovaConnect\Gateway"

# Activer la licence
bun run activate --license NOVA-XXXX-XXXX-XXXX-XXXX --school votre-school-uuid
```

## 🌐 Accès

Une fois installé, le Gateway est accessible sur:

```
API:        http://localhost:3001
Admin:      http://localhost:3001/admin
Health:     http://localhost:3001/health
```

Depuis le réseau local (après configuration de l'IP statique):

```
http://192.168.1.100:3001/admin
```

## 🗑️ Désinstallation

```powershell
# Option 1: Via Panneau de configuration
# Programmes et fonctionnalités → NovaConnect Gateway → Désinstaller

# Option 2: Via le script de désinstallation
.\uninstall.ps1

# Option 3: Manuellement
Stop-Service NovaConnectGateway
nssm remove NovaConnectGateway confirm
Remove-Item -Recurse "C:\Program Files\NovaConnect\Gateway"
Remove-Item -Recurse "C:\ProgramData\NovaConnect\Gateway"
```

## 📊 Logs et surveillance

**Emplacement des logs:**

```
C:\ProgramData\NovaConnect\Gateway\logs\
├── gateway.log       # Logs du Gateway
├── error.log         # Logs d'erreur
├── stdout.log        # Sortie standard (via NSSM)
└── stderr.log        # Erreurs standard (via NSSM)
```

**Voir les logs en temps réel:**

```powershell
# PowerShell 7+
Get-Content "C:\ProgramData\NovaConnect\Gateway\logs\gateway.log" -Wait -Tail 50

# PowerShell 5.1 (ancien)
Get-Content "C:\ProgramData\NovaConnect\Gateway\logs\gateway.log" -Tail 50 -Wait
```

**Observateur d'événements Windows:**

```powershell
eventvwr.msc
# Logs Windows → Journaux des applications → NovaConnectGateway
```

## 🔧 Dépannage

### Le service ne démarre pas

```powershell
# Vérifier les logs
Get-Content "C:\ProgramData\NovaConnect\Gateway\logs\error.log" -Tail 50

# Vérifier la configuration
Get-Content "C:\ProgramData\NovaConnect\Gateway\.env"

# Redémarrer le service
Restart-Service NovaConnectGateway
```

### Problème de port

```powershell
# Vérifier si le port est utilisé
netstat -an | Select-String "3001"

# Changer le port dans .env
notepad C:\ProgramData\NovaConnect\Gateway\.env
# Modifier: PORT=3001

# Redémarrer le service
Restart-Service NovaConnectGateway
```

### Problème de pare-feu

```powershell
# Vérifier la règle de pare-feu
Get-NetFirewallRule -DisplayName "NovaConnect Gateway"

# Ajouter la règle manuellement
New-NetFirewallRule -DisplayName "NovaConnect Gateway" `
    -Direction Inbound `
    -LocalPort 3001 `
    -Protocol TCP `
    -Action Allow
```

## 📚 Documentation complète

- [Déploiement Linux](../DEPLOYMENT.md)
- [Déploiement Production](../../../../DEPLOYMENT_PRODUCTION_COMPLET.md)
- [Architecture](../../../../docs/architecture/overview.md)

## 💰 Coût de la licence Windows

Pour un déploiement en production, vous aurez besoin d'une licence Windows valide:

- **Windows 10/11 Home**: Inclus avec la plupart des PC
- **Windows 10/11 Pro**: ~$99-149 USD
- **Windows Server**: à partir de ~$500 USD

**Alternative**: Utiliser Linux (Raspberry Pi OS, Ubuntu) qui est gratuit.

## 📞 Support

- **Documentation**: https://docs.novaconnect.app
- **Email**: support@novaconnect.app
- **Issues**: https://github.com/novaconnect/gateway/issues

---

**Version**: 1.0.0
**Dernière mise à jour**: 2025-01-19
