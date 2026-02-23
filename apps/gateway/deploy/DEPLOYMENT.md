# 🚀 NovaConnect Gateway - Guide de Déploiement Production

Ce guide couvre le déploiement complet du NovaConnect Gateway en production, avec ou sans Docker.

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Méthodes de Déploiement](#méthodes-de-déploiement)
3. [Option 1: Déploiement avec Docker](#option-1-déploiement-avec-docker)
4. [Option 2: Déploiement sans Docker](#option-2-déploiement-sans-docker)
5. [Configuration HTTPS avec Nginx](#configuration-https-avec-nginx)
6. [Monitoring et Maintenance](#monitoring-et-maintenance)
7. [Backup et Restauration](#backup-et-restauration)
8. [Dépannage](#dépannage)

---

## Prérequis

### Système
- **OS**: Raspberry Pi OS (Debian 11+), Ubuntu 20.04+, ou compatible
- **RAM**: Minimum 512 MB (1 GB recommandé)
- **Stockage**: Minimum 4 GB (16 GB recommandé pour les logs)
- **Architecture**: x86_64, ARM64, ARMv7

### Logiciels
- **Bun** 1.1+ (Runtime JavaScript)
- **Docker** 20.10+ (optionnel, pour déploiement Docker)
- **Docker Compose** 2.0+ (optionnel)
- **Nginx** 1.18+ (recommandé pour HTTPS)

### Réseau
- Adresse IP statique ou DHCP réservation
- Ports ouverts: 80 (HTTP), 443 (HTTPS), 3001 (Gateway API)

---

## Méthodes de Déploiement

NovaConnect Gateway peut être déployé de quatre manières :

| Méthode | Avantages | Inconvénients | Utilisation recommandée |
|---------|-----------|---------------|------------------------|
| **Docker** | Isolation complète, gestion facile, rollback rapide | Surcharge légère (~50 MB), nécessite Docker | Production, multi-tenants |
| **Native Linux** | Performance optimale, pas de surcharge | Gestion manuelle des dépendances | Raspberry Pi, ressources limitées |
| **Windows PC** | Facile à installer, interface familière | Nécessite Windows 10/11, moins performant | Écoles sans expertise Linux |
| **Windows Service** | Démarrage automatique, stable | Installation plus complexe | Production sur serveur Windows |

---

## Option 1: Déploiement avec Docker

### Étape 1: Installer Docker

```bash
# Sur Raspberry Pi OS / Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur courant au groupe docker
sudo usermod -aG docker $USER

# Se reconnecter pour appliquer les changements
```

### Étape 2: Préparer la Configuration

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer la configuration
nano .env
```

**Variables obligatoires dans `.env`** :

```env
# Identifiant de l'école
SCHOOL_ID=ecole-uuid-123

# Configuration Supabase (fallback cloud)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Port
GATEWAY_PORT=3001

# Répertoire de données (local ou monté Docker)
DATABASE_PATH=/app/data
```

### Étape 3: Construire et Démarrer

```bash
# Construire l'image Docker
docker-compose build

# Démarrer le service
docker-compose up -d

# Vérifier les logs
docker-compose logs -f gateway

# Vérifier le statut
docker-compose ps
```

### Étape 4: Activer la Licence

```bash
# Exécuter la commande d'activation dans le container
docker-compose exec gateway bun run activate --license=XXXX --school=YYYY
```

### Étape 5: Vérifier le Fonctionnement

```bash
# Health check
curl http://localhost:3001/health

# Interface admin
# Ouvrir dans le navigateur: http://localhost:3001/admin
```

### Commandes Docker Utiles

```bash
# Voir les logs
docker-compose logs -f gateway

# Redémarrer
docker-compose restart gateway

# Arrêter
docker-compose down

# Mettre à jour
docker-compose pull
docker-compose up -d --build

# Accéder au shell du container
docker-compose exec gateway bash

# Vérifier l'utilisation des ressources
docker stats novaconnect-gateway
```

---

## Option 2: Déploiement sans Docker

### Étape 1: Installation Automatique (Recommandé)

```bash
# Exécuter le script d'installation
sudo bash deploy/scripts/install.sh
```

Le script va :
- ✅ Installer Bun
- ✅ Installer les dépendances système
- ✅ Créer l'utilisateur `gateway`
- ✅ Configurer les répertoires
- ✅ Installer PM2
- ✅ Configurer le firewall

### Étape 2: Installation Manuelle

Si vous préférez installer manuellement :

```bash
# 1. Installer Bun
curl -fsSL https://bun.sh/install | bash

# 2. Créer l'utilisateur gateway
sudo useradd -r -s /bin/false -d /var/www/novaconnect-gateway gateway

# 3. Créer les répertoires
sudo mkdir -p /var/www/novaconnect-gateway/{data,logs,backups}
sudo chown -R gateway:gateway /var/www/novaconnect-gateway

# 4. Copier les fichiers
sudo cp -r . /var/www/novaconnect-gateway/
sudo chown -R gateway:gateway /var/www/novaconnect-gateway

# 5. Installer les dépendances
cd /var/www/novaconnect-gateway
sudo -u gateway bun install
```

### Étape 3: Configuration

```bash
# Créer le fichier .env
sudo -u gateway cp .env.example .env

# Éditer la configuration
sudo -u gateway nano .env
```

### Étape 4: Activer la Licence

```bash
sudo -u gateway bun run activate --license=XXXX --school=YYYY
```

### Étape 5: Démarrer avec PM2

```bash
# Démarrer avec PM2
sudo -u gateway pm2 start deploy/ecosystem.config.cjs --env production
sudo -u gateway pm2 save

# Démarrer PM2 au boot
sudo -u gateway pm2 startup systemd
```

### Étape 6: Vérifier le Fonctionnement

```bash
# Statut PM2
sudo -u gateway pm2 status

# Logs
sudo -u gateway pm2 logs novaconnect-gateway

# Health check
curl http://localhost:3001/health
```

### Alternative: Démarrer avec Systemd

```bash
# Copier le service systemd
sudo cp deploy/systemd/novaconnect-gateway.service /etc/systemd/system/

# Recharger systemd
sudo systemctl daemon-reload

# Activer le service au démarrage
sudo systemctl enable novaconnect-gateway

# Démarrer le service
sudo systemctl start novaconnect-gateway

# Vérifier le statut
sudo systemctl status novaconnect-gateway
```

---

## Migrations SQLite (Gateway)

- DATABASE_PATH pointe vers un dossier (pas un fichier). La base locale s'appelle <SCHOOL_ID>.db dans ce dossier.
- Au demarrage, le Gateway applique automatiquement toutes les migrations presentes dans apps/gateway/src/db/migrations.
- Pour un lancement manuel (sans demarrer le serveur), utilisez les commandes suivantes :

```bash
# Appliquer les migrations
bun run migrate

# Lister les migrations appliquees
bun run migrate:list

# Verifier les migrations manquantes/orphelines
bun run migrate:status

# Creer une nouvelle migration
bun run migrate:new --name "describe_change"
```

En Docker :

```bash
# Exemple: statut des migrations dans le container
docker compose exec gateway bun run migrate:status
```

Note : ne modifiez pas schema.sql directement pour les evolutions. Ajoutez une migration.

## Option 3: Déploiement sur Windows PC (Local)

Cette option est idéale pour les écoles qui veulent installer le Gateway sur un PC Windows standard connecté au réseau local de l'école.

### Prérequis Windows

- **OS**: Windows 10 (64-bit) ou Windows 11 (64-bit)
- **RAM**: Minimum 4 GB (8 GB recommandé)
- **Stockage**: Minimum 10 GB d'espace libre
- **Réseau**: Carte Ethernet ou WiFi connectée au réseau local
- **Permissions**: Droits administrateur

### Méthode A: Installation Automatisée (Recommandée)

#### Étape 1: Créer l'Installateur

```powershell
# Depuis la racine du projet
cd apps/gateway/deploy/windows

# Exécuter le script de build
.\build.ps1 -Version "1.0.0"

# L'installateur sera créé dans: .\dist\NovaConnect-Gateway-Setup-1.0.0.exe
```

**Prérequis pour le build:**

- NSIS 3.0+ (https://nsis.sourceforge.io/)
- Git (inclus dans Windows)
- Bun (sera installé automatiquement si absent)

#### Étape 2: Exécuter l'Installateur

```
1. Double-cliquer sur "NovaConnect-Gateway-Setup-1.0.0.exe"
2. Accepter le contrat de licence
3. Choisir le répertoire d'installation (C:\Program Files\NovaConnect\Gateway par défaut)
4. Sélectionner les composants:
   ✓ Gateway Core (requis)
   ✓ Configuration initiale (recommandé)
   ✓ Démarrer le service (optionnel)
5. Cliquer sur "Installer"
6. Attendre la fin de l'installation (~5-10 minutes)
```

L'installateur inclut:
- ✅ Tous les fichiers nécessaires du Gateway
- ✅ Bun Runtime (installé automatiquement)
- ✅ Scripts de gestion PowerShell
- ✅ Service Windows avec NSSM
- ✅ Raccourcis dans le menu Démarrer
- ✅ Configuration du pare-feu

#### Étape 3: Configuration Initiale

#### Étape 3: Configuration Initiale

Au premier démarrage, l'interface de configuration s'ouvre automatiquement:

```powershell
# Ou lancer manuellement:
Start-Process "C:\Program Files\NovaConnect\Gateway\config-ui.exe"
```

**Configuration requise:**

```ini
[Supabase]
SCHOOL_ID=votre-ecole-uuid-ici
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_KEY=votre-service-key

[Database]
DATABASE_PATH=C:\ProgramData\NovaConnect\Gateway\data

[Network]
PORT=3001
IP_ADDRESS=auto  # ou spécifier l'IP: 192.168.1.100

[Sync]
SYNC_INTERVAL=30000  # 30 secondes

[Logging]
LOG_LEVEL=info
LOG_PATH=C:\ProgramData\NovaConnect\Gateway\logs
```

#### Étape 5: Activer la Licence

```powershell
# Via l'interface graphique:
# Onglet "Licence" → Entrer la clé de licence → "Activer"

# Ou via PowerShell:
cd "C:\Program Files\NovaConnect\Gateway"
.\gateway-cli.exe activate --license NOVA-XXXX-XXXX-XXXX-XXXX --school votre-ecole-uuid
```

#### Étape 6: Démarrer le Service

```powershell
# Via l'interface graphique:
# Bouton "Démarrer le Service"

# Ou via PowerShell:
Start-Service NovaConnectGateway

# Vérifier le statut:
Get-Service NovaConnectGateway
```

#### Étape 7: Vérifier le Fonctionnement

```powershell
# Health check via PowerShell:
Invoke-WebRequest -Uri http://localhost:3001/health -UseBasicParsing

# Ou ouvrir dans le navigateur:
Start-Process http://localhost:3001/admin
```

### Méthode B: Installation via Script PowerShell

Pour les utilisateurs avancés qui préfèrent un contrôle total, installation via script PowerShell sans interface graphique:

#### Étape 1: Exécuter le script d'installation

```powershell
# Naviguer vers le dossier windows
cd apps/gateway/deploy/windows

# Ouvrir PowerShell en tant qu'administrateur
# Clic droit sur dossier -> Ouvrir dans Terminal -> Administrateur

# Exécuter le script d'installation
.\install.ps1

# Le script va:
# - Vérifier les prérequis (Windows 10/11, RAM, espace disque)
# - Installer Bun si nécessaire
# - Installer NSSM si nécessaire
# - Créer les répertoires
# - Copier les fichiers
# - Installer les dépendances
# - Configurer le pare-feu
# - Créer le service Windows
# - Demander la configuration initiale

# Options avancées:
.\install.ps1 -InstallPath "C:\NovaConnect\Gateway" -DataPath "C:\ProgramData\NovaConnect"
.\install.ps1 -SkipBunInstall -SkipNSSMInstall  # Si déjà installés
.\install.ps1 -ConfigureOnly  # Configuration uniquement
```

```powershell
# Créer le répertoire d'installation
New-Item -ItemType Directory -Path "C:\NovaConnect\Gateway" -Force
cd C:\NovaConnect\Gateway

# Télécharger et extraire l'archive
# (Télécharger depuis: https://github.com/novaconnect/gateway/releases/latest)
Expand-Archive -Path .\gateway-windows-latest.zip -DestinationPath . -Force
```

#### Étape 2: Configuration

```powershell
# Le script va automatiquement créer le fichier .env
# et demander la configuration

# Pour configurer plus tard, utiliser le script de configuration:
cd C:\Program Files\NovaConnect\Gateway\scripts
.\configure.ps1

# Ou éditer manuellement:
notepad C:\ProgramData\NovaConnect\Gateway\.env
```

**Contenu du fichier `.env` (généré automatiquement à partir de .env.example):**

```env
# Configuration NovaConnect Gateway

# Identifiant de l'école
SCHOOL_ID=your-school-uuid-here

# Configuration Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Base de données
DATABASE_PATH=C:\NovaConnect\Gateway\data

# Réseau
PORT=3001
HOST=0.0.0.0

# Synchronisation
SYNC_INTERVAL=30000

# Logging
LOG_LEVEL=info
LOG_PATH=C:\NovaConnect\Gateway\logs

# Licence
LICENSE_FILE=C:\NovaConnect\Gateway\license.json
```

#### Étape 3: Service Windows (créé automatiquement)

```powershell
# Le service Windows est créé automatiquement par le script d'installation
# Il utilise NSSM (Non-Sucking Service Manager) pour la gestion

# Vérifier que le service est créé:
Get-Service NovaConnectGateway

# Le service est configuré pour:
# - Démarrage automatique au boot
# - Redémarrage automatique en cas d'échec
# - Logs redirigés vers C:\ProgramData\NovaConnect\Gateway\logs\
```

### Méthode C: Archive Portable (Sans Installation)

Pour une installation portable sans service Windows (idéal pour testing ou développement):

```powershell
# Depuis le dossier deploy/windows, créer l'archive portable:
.\build.ps1 -Version "1.0.0" -SkipInstaller

# Extraire l'archive portable
Expand-Archive .\dist\NovaConnect-Gateway-Windows-1.0.0.zip -DestinationPath C:\NovaConnect\Gateway -Force

# Naviguer vers le répertoire
cd C:\NovaConnect\Gateway

# Créer le fichier .env
copy .env.example .env
notepad .env  # Configurer les variables requises

# Installer les dépendances
bun install

# Démarrer en mode console
bun run start

# Le Gateway va démarrer et afficher les logs dans la console
# Pour arrêter: Ctrl+C
```

### Configuration du Pare-feu Windows

```powershell
# Ajouter une règle de pare-feu pour permettre les connexions entrantes
New-NetFirewallRule -DisplayName "NovaConnect Gateway" `
    -Direction Inbound `
    -LocalPort 3001 `
    -Protocol TCP `
    -Action Allow

# Vérifier la règle
Get-NetFirewallRule -DisplayName "NovaConnect Gateway"
```

### Configuration de l'IP Statique (Recommandé)

Pour éviter que l'IP du Gateway ne change:

```powershell
# Via l'interface graphique:
# 1. Ouvrir "Paramètres" → "Réseau et Internet" → "Ethernet"
# 2. Cliquer sur "Modifier les options de l'adaptateur"
# 3. Clic droit sur "Ethernet" → "Propriétés"
# 4. Sélectionner "Protocole Internet version 4 (TCP/IPv4)"
# 5. Cliquer sur "Propriétés"
# 6. Sélectionner "Utiliser l'adresse IP suivante:"
# 7. Entrer:
#    - Adresse IP: 192.168.1.100 (ou une IP libre)
#    - Masque de sous-réseau: 255.255.255.0
#    - Passerelle: 192.168.1.1 (adresse du routeur)
#    - Serveur DNS préféré: 192.168.1.1 (ou 8.8.8.8)

# Ou via PowerShell:
New-NetIPAddress -InterfaceAlias "Ethernet" `
    -IPAddress 192.168.1.100 `
    -PrefixLength 24 `
    -DefaultGateway 192.168.1.1
```

### Accès depuis le Réseau Local

Une fois le Gateway démarré, les autres appareils du réseau peuvent y accéder:

```powershell
# L'URL dépend de l'IP de la machine Windows:
# http://192.168.1.100:3001/health

# Tester depuis une autre machine:
Invoke-WebRequest -Uri http://192.168.1.100:3001/health -UseBasicParsing
```

### Démarrage Automatique au Boot

Le service Windows configuré avec NSSM démarre automatiquement au boot. Pour vérifier:

```powershell
# Vérifier que le service est en mode automatique
Get-Service NovaConnectGateway | Select-Object Name, StartType, Status

# Résultat attendu:
# Name                  StartType  Status
# ----                  ---------  ------
# NovaConnectGateway    Automatic  Running
```

### Gestion du Service Windows

```powershell
# Démarrer le service
Start-Service NovaConnectGateway

# Arrêter le service
Stop-Service NovaConnectGateway

# Redémarrer le service
Restart-Service NovaConnectGateway

# Vérifier le statut
Get-Service NovaConnectGateway

# Voir les logs du service
Get-EventLog -LogName Application -Source "NovaConnectGateway" -Newest 50
```

### Surveillance et Logs

```powershell
# Les logs sont stockés dans:
# C:\ProgramData\NovaConnect\Gateway\logs\

# Voir les logs en temps réel (PowerShell 7+):
Get-Content "C:\ProgramData\NovaConnect\Gateway\logs\gateway.log" -Wait -Tail 50

# Ou avec l'observateur d'événements Windows:
eventvwr.msc
# Logs Windows → Journaux des applications → NovaConnectGateway
```

### Interface de Monitoring Web

Le Gateway inclut une interface web de monitoring accessible:

```powershell
# Ouvrir dans le navigateur:
Start-Process http://localhost:3001/admin

# L'interface affiche:
# - Statut du service
# - Métriques HTTP
# - Statistiques de synchronisation
# - État de la base de données
# - Ressources système (CPU, RAM, disque)
# - Logs en temps réel
```

### Backup Automatisé sur Windows

```powershell
# Créer une tâche planifiée pour le backup quotidien
$action = New-ScheduledTaskAction -Execute "C:\NovaConnect\Gateway\scripts\backup.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$definition = New-ScheduledTask -Action $action -Principal $principal -Trigger $trigger
Register-ScheduledTask -TaskName "NovaConnect Gateway Backup" -InputObject $definition
```

### Mise à Jour du Gateway

```powershell
# Via l'interface graphique:
# Onglet "Mise à jour" → "Vérifier les mises à jour" → "Installer"

# Ou manuellement:
Stop-Service NovaConnectGateway
cd C:\NovaConnect\Gateway
git pull origin main
bun install
Start-Service NovaConnectGateway
```

### Désinstallation

```powershell
# Via l'installateur:
# "Panorama de configuration" → "Programmes et fonctionnalités"
# → "NovaConnect Gateway" → "Désinstaller"

# Ou manuellement:
Stop-Service NovaConnectGateway
nssm remove NovaConnectGateway confirm
Remove-Item -Recurse -Force "C:\NovaConnect\Gateway"
Remove-Item -Recurse -Force "C:\ProgramData\NovaConnect\Gateway"
```

### Avantages du Déploiement Windows PC

✅ **Facilité d'installation**: Interface graphique familière
✅ **Gestion simplifiée**: Service Windows avec MMC
✅ **Monitoring intégré**: Observateur d'événements Windows
✅ **Backup automatique**: Planificateur de tâches Windows
✅ **Mise à jour facile**: Installateur automatique
✅ **Support IT**: La plupart des techniciens connaissent Windows

### Inconvénients

❌ **Coût**: Licence Windows requise
❌ **Performance**: Moins performant que Linux
❌ **Stabilité**: Redémarrages Windows obligatoires pour les updates
❌ **Ressources**: Plus gourmand en RAM/CPU

---

## Option 4: Déploiement comme Windows Service (Production)

Pour les déploiements en production sur serveur Windows, utiliser un service Windows avec configuration avancée.

### Prérequis

- Windows Server 2019/2022 ou Windows 10/11 Pro
- Droits administrateur
- .NET Framework 4.8+ (inclus dans Windows)

### Installation avec NSSM Avancé

```powershell
# Télécharger NSSM
# https://nssm.cc/download

# Installer NSSM dans C:\Windows\System32
Copy-Item nssm.exe C:\Windows\System32\

# Créer le service avec configuration avancée
nssm install NovaConnectGateway "C:\Users\<username>\.bun\bin\bun.exe" "run start"

# Configuration avancée du service
nssm set NovaConnectGateway AppDirectory "C:\NovaConnect\Gateway"
nssm set NovaConnectGateway AppEnvironmentExtra "NODE_ENV=production" "PORT=3001"
nssm set NovaConnectGateway AppStdout "C:\ProgramData\NovaConnect\Gateway\logs\stdout.log"
nssm set NovaConnectGateway AppStderr "C:\ProgramData\NovaConnect\Gateway\logs\stderr.log"
nssm set NovaConnectGateway AppRotateFiles 1
nssm set NovaConnectGateway AppRotateBytes 10485760

# Démarrage automatique avec dépendances
nssm set NovaConnectGateway Start SERVICE_AUTO_START
nssm set NovaConnectGateway DependOnService Tcpip

# Redémarrage en cas d'échec
nssm set NovaConnectGateway AppThrottle 1500
nssm set NovaConnectGateway AppExit Default Restart
nssm set NovaConnectGateway AppRestartDelay 10000
nssm set NovaConnectGateway AppRestartDelay 300000

# Démarrer le service
nssm start NovaConnectGateway
```

### Surveillance avec Performance Monitor

```powershell
# Ajouter des compteurs de performance
# Ouvrir: Performance Monitor (perfmon.msc)
# Compteurs à surveiller:
# - Processeur -> % temps processeur -> bun
# - Mémoire -> Octets privés -> bun
# - Processus -> Nombre de handles -> bun
```

---

## Configuration HTTPS avec Nginx

### Pourquoi utiliser Nginx ?

- 🔒 **HTTPS** avec Let's Encrypt
- 🛡️ **Sécurité** renforcée (headers, rate limiting)
- 🌐 **Nom de domaine** personnalisé
- 📊 **Logs centralisés**
- ⚡ **Performance** (cache, compression)

### Étape 1: Installer Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### Étape 2: Configuration de Base

```bash
# Copier la configuration Nginx
sudo cp deploy/nginx/novaconnect-gateway.conf /etc/nginx/sites-available/

# Modifier le domaine
sudo nano /etc/nginx/sites-available/novaconnect-gateway
# Remplacez "gateway.your-domain.com" par votre domaine réel

# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/novaconnect-gateway /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### Étape 3: Configuration HTTPS avec Let's Encrypt

```bash
# Exécuter le script de configuration SSL
sudo bash deploy/nginx/setup-ssl.sh votre-domaine.com admin@votre-domaine.com
```

Le script va :
- ✅ Installer Certbot
- ✅ Obtenir un certificat SSL gratuit
- ✅ Configurer le renouvellement automatique
- ✅ Activer HTTPS

### Étape 4: Vérifier HTTPS

```bash
# Test de configuration
curl https://votre-domaine.com/health

# Vérifier la note SSL (A+)
openssl s_client -connect votre-domaine.com:443 -servername votre-domaine.com </dev/null
```

### Certificat Auto-signé (Développement)

Pour le développement ou les tests locaux :

```bash
# Générer un certificat auto-signé
sudo bash deploy/nginx/self-signed-cert.sh gateway.local

# Mettre à jour la configuration Nginx pour utiliser le certificat auto-signé
```

---

## Monitoring et Maintenance

### Monitoring en Temps Réel

```bash
# Lancer le dashboard de monitoring
bash deploy/scripts/monitor.sh
```

Le dashboard affiche :
- ✅ Statut du service
- ✅ Métriques HTTP
- ✅ Statistiques de synchronisation
- ✅ Base de données
- ✅ Ressources système (CPU, RAM, disque)
- ✅ Logs récents

### Health Check Automatisé

```bash
# Exécuter un health check manuel
bash deploy/scripts/health-check.sh

# Résultat attendu:
# ╔════════════════════════════════════════╗
# ║  ✅ Tous les checks sont OK (7/7)     ║
# ╚════════════════════════════════════════╝
```

### Configuration du Cron Jobs

```bash
# Installer les tâches automatisées
sudo cp deploy/cron/health-check.cron /etc/cron.d/novaconnect-gateway
sudo chmod 644 /etc/cron.d/novaconnect-gateway
sudo systemctl restart cron
```

Tâches automatisées :
- Health check toutes les 5 minutes
- Backup toutes les heures
- Nettoyage des logs tous les jours à 2h
- Sync toutes les 10 minutes

### Logs

```bash
# Logs du Gateway
tail -f /var/www/novaconnect-gateway/logs/gateway.log

# Logs d'erreur
tail -f /var/www/novaconnect-gateway/logs/error.log

# Logs PM2
sudo -u gateway pm2 logs novaconnect-gateway

# Logs Docker
docker-compose logs -f gateway

# Logs Nginx
tail -f /var/log/nginx/novaconnect-gateway-*.log
```

---

## Backup et Restauration

### Backup Automatique

```bash
# Exécuter un backup manuel
bash deploy/scripts/backup.sh

# Résultat:
# ╔════════════════════════════════════════╗
# ║  ✅ Backup terminé !                   ║
# ╚════════════════════════════════════════╝
# 📦 Archive: /var/www/novaconnect-gateway/backups/gateway_backup_20250118_143022.tar.gz
# 📊 Taille: 2.3M
```

### Restauration

```bash
# Lister les backups disponibles
ls -lh /var/www/novaconnect-gateway/backups/*.tar.gz

# Restaurer un backup
bash deploy/scripts/restore.sh /var/www/novaconnect-gateway/backups/gateway_backup_20250118_143022.tar.gz
```

### Backup sur Stockage Externe

```bash
# Script pour envoyer les backups sur S3, Google Drive, etc.
cat > /var/www/novaconnect-gateway/deploy/scripts/backup-remote.sh << 'EOF'
#!/bin/bash
# Backup vers S3 (exemple avec AWS CLI)
BUCKET="s3://novaconnect-backups/gateway/"
LATEST_BACKUP=$(ls -t /var/www/novaconnect-gateway/backups/*.tar.gz | head -1)
aws s3 cp "$LATEST_BACKUP" "$BUCKET"
EOF

chmod +x /var/www/novaconnect-gateway/deploy/scripts/backup-remote.sh
```

---

## Dépannage

### Le Gateway ne démarre pas

```bash
# Vérifier les logs
pm2 logs novaconnect-gateway --lines 50

# Vérifier que Bun est installé
bun --version

# Vérifier la configuration
cat /var/www/novaconnect-gateway/.env

# Vérifier les permissions
ls -la /var/www/novaconnect-gateway/data
```

### Erreur de licence

```bash
# Vérifier la licence
sqlite3 /var/www/novaconnect-gateway/data/*.db "SELECT * FROM gateway_license"

# Réactiver la licence
cd /var/www/novaconnect-gateway
bun run activate --license=XXXX --school=YYYY

# Vérifier le hardware fingerprint
node -e "console.log(require('node-machine-id').machineIdSync())"
```

### Erreur de synchronisation

```bash
# Vérifier le statut de sync
curl http://localhost:3001/api/sync/status

# Déclencher une sync manuelle
curl -X POST http://localhost:3001/api/sync/trigger

# Réessayer les événements échoués
curl -X POST http://localhost:3001/api/sync/retry

# Nettoyer les anciens événements
curl -X POST http://localhost:3001/api/sync/cleanup
```

### Base de données corrompue

```bash
# Arrêter le Gateway
pm2 stop novaconnect-gateway

# Backup de la base de données corrompue
cp /var/www/novaconnect-gateway/data/*.db /var/www/novaconnect-gateway/backups/corrupted_$(date +%Y%m%d).db

# Restaurer depuis un backup
bash deploy/scripts/restore.sh /var/www/novaconnect-gateway/backups/gateway_backup_XXXXXX.tar.gz

# Redémarrer
pm2 restart novaconnect-gateway
```

### Espace disque insuffisant

```bash
# Vérifier l'espace disque
df -h

# Nettoyer les anciens logs
find /var/www/novaconnect-gateway/logs -name "*.log" -mtime +7 -delete

# Nettoyer les anciens backups
find /var/www/novaconnect-gateway/backups -name "*.tar.gz" -mtime +30 -delete

# Nettoyer les événements synchronisés
sqlite3 /var/www/novaconnect-gateway/data/*.db "DELETE FROM event_log WHERE sync_status = 'synced' AND synced_at < datetime('now', '-7 days')"
```

### Problèmes réseau

```bash
# Vérifier que le port est ouvert
sudo netstat -tlnp | grep 3001

# Vérifier le firewall
sudo ufw status

# Ouvrir le port si nécessaire
sudo ufw allow 3001/tcp

# Tester la connectivité locale
curl http://localhost:3001/health

# Tester la connectivité externe
curl http://VOTRE_IP:3001/health
```

---

## 📚 Ressources Supplémentaires

### Documentation
- [Guide d'administration](./ADMIN.md)
- [API Reference](./API.md)
- [Architecture](./ARCHITECTURE.md)

### Support
- Issues GitHub: https://github.com/novaconnect/gateway/issues
- Documentation: https://docs.novaconnect.com
- Email: tech@novaconnect.com

---

## ✅ Checklist de Déploiement

Avant de considérer le déploiement comme terminé, vérifiez :

- [ ] Gateway installé et démarré
- [ ] Licence activée et valide
- [ ] Health check OK
- [ ] Synchronisation fonctionnelle
- [ ] HTTPS configuré (production)
- [ ] Firewall configuré
- [ ] Backup automatique en place
- [ ] Monitoring configuré
- [ ] Logs accessibles
- [ ] Documentation mise à jour

---

**🎉 Félicitations ! Votre NovaConnect Gateway est maintenant en production !**
