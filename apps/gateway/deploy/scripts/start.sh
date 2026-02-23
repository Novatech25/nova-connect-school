#!/bin/bash
# ==============================================
# NovaConnect Gateway - Script de démarrage
# ==============================================

set -e

GATEWAY_DIR="/var/www/novaconnect-gateway"
GATEWAY_USER="gateway"

echo "🚀 Démarrage de NovaConnect Gateway..."

# Vérifier que le répertoire existe
if [ ! -d "$GATEWAY_DIR" ]; then
    echo "❌ Le répertoire $GATEWAY_DIR n'existe pas"
    exit 1
fi

cd $GATEWAY_DIR

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    sudo -u $GATEWAY_USER bun install
fi

# Vérifier que le fichier .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env introuvable, utilisation des valeurs par défaut"
fi

# Démarrer avec PM2
if command -v pm2 &> /dev/null; then
    echo "📦 Démarrage avec PM2..."
    sudo -u $GATEWAY_USER pm2 start ecosystem.config.cjs --env production
    sudo -u $GATEWAY_USER pm2 save
    echo "✅ Gateway démarré avec PM2"
    echo ""
    echo "📊 Commandes utiles :"
    echo "   pm2 logs novaconnect-gateway"
    echo "   pm2 status"
    echo "   pm2 restart novaconnect-gateway"
else
    echo "📦 Démarrage direct avec Bun..."
    sudo -u $GATEWAY_USER bun run start
fi
