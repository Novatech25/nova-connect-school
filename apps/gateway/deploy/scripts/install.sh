#!/bin/bash
# ==============================================
# NovaConnect Gateway - Script d'installation
# Pour Raspberry Pi OS / Debian / Ubuntu
# ==============================================

set -e

echo "╔════════════════════════════════════════╗"
echo "║  NovaConnect Gateway Installation      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Vérifier si l'utilisateur est root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Ce script doit être exécuté en tant que root (sudo)"
    exit 1
fi

# Détecter l'architecture
ARCH=$(uname -m)
echo "📟 Architecture détectée: $ARCH"

# Installer les dépendances système
echo "📦 Installation des dépendances système..."
apt-get update
apt-get install -y \
    curl \
    wget \
    git \
    sqlite3 \
    ca-certificates \
    build-essential \
    pkg-config \
    ufw \
    nginx

# Installer Bun
echo "🥟 Installation de Bun..."
if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    # Ajouter Bun au PATH pour tous les utilisateurs
    echo 'export BUN_INSTALL="$HOME/.bun"' >> /etc/profile
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /etc/profile
else
    echo "✅ Bun est déjà installé"
fi

# Créer l'utilisateur gateway
echo "👤 Création de l'utilisateur gateway..."
if ! id -u gateway > /dev/null 2>&1; then
    useradd -r -s /bin/false -d /var/www/novaconnect-gateway gateway
    echo "✅ Utilisateur gateway créé"
else
    echo "✅ Utilisateur gateway existe déjà"
fi

# Créer les répertoires
echo "📁 Création des répertoires..."
mkdir -p /var/www/novaconnect-gateway
mkdir -p /var/www/novaconnect-gateway/data
mkdir -p /var/www/novaconnect-gateway/logs
mkdir -p /var/www/novaconnect-gateway/backups

# Copier les fichiers si on est dans le dossier du projet
if [ -f "./package.json" ]; then
    echo "📋 Copie des fichiers du projet..."
    cp -r . /var/www/novaconnect-gateway/
    chown -R gateway:gateway /var/www/novaconnect-gateway
else
    echo "⚠️  Fichiers du projet non trouvés, vous devrez les copier manuellement"
fi

# Installer PM2 globalement
echo "📦 Installation de PM2..."
if ! command -v pm2 &> /dev/null; then
    bun install -g pm2
    pm2 install systemd
    echo "✅ PM2 installé"
else
    echo "✅ PM2 est déjà installé"
fi

# Configurer le firewall
echo "🔒 Configuration du firewall..."
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 3001/tcp comment 'Gateway API'
ufw --force enable
echo "✅ Firewall configuré"

# Configurer Nginx (optionnel)
echo "🌐 Configuration de Nginx..."
if [ -f "/etc/nginx/sites-available/novaconnect-gateway" ]; then
    echo "⚠️  La configuration Nginx existe déjà"
else
    echo "ℹ️  Vous devrez configurer Nginx manuellement (voir deploy/nginx/)"
fi

# Terminer
echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Installation terminée !            ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📝 Étapes suivantes :"
echo ""
echo "1. Copier les fichiers du projet :"
echo "   sudo cp -r . /var/www/novaconnect-gateway/"
echo ""
echo "2. Configurer les variables d'environnement :"
echo "   cd /var/www/novaconnect-gateway"
echo "   cp .env.example .env"
echo "   nano .env  # Éditer la configuration"
echo ""
echo "3. Installer les dépendances :"
echo "   cd /var/www/novaconnect-gateway"
echo "   bun install"
echo ""
echo "4. Activer la licence :"
echo "   bun run activate --license=XXXX --school=YYYY"
echo ""
echo "5. Démarrer le service :"
echo "   pm2 start ecosystem.config.cjs"
echo "   pm2 save"
echo ""
echo "6. Configurer Nginx (recommandé pour HTTPS) :"
echo "   sudo cp deploy/nginx/novaconnect-gateway /etc/nginx/sites-available/"
echo "   sudo ln -s /etc/nginx/sites-available/novaconnect-gateway /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "📚 Documentation: deploy/DEPLOYMENT.md"
echo ""
