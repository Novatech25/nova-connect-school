#!/bin/bash
# ==============================================
# NovaConnect Gateway - Script de redémarrage
# ==============================================

set -e

echo "🔄 Redémarrage de NovaConnect Gateway..."

if command -v pm2 &> /dev/null; then
    echo "📦 Redémarrage avec PM2..."
    pm2 restart novaconnect-gateway
    echo "✅ Gateway redémarré"
    echo ""
    echo "📊 Statut :"
    pm2 status
else
    echo "⚠️  PM2 n'est pas installé"
    echo "ℹ️  Veuillez utiliser les scripts start.sh et stop.sh"
fi
