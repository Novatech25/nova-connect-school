#!/bin/bash
# ==============================================
# NovaConnect Gateway - Script d'arrêt
# ==============================================

set -e

echo "🛑 Arrêt de NovaConnect Gateway..."

if command -v pm2 &> /dev/null; then
    echo "📦 Arrêt avec PM2..."
    pm2 stop novaconnect-gateway
    echo "✅ Gateway arrêté"
else
    echo "⚠️  PM2 n'est pas installé, impossible d'arrêter proprement"
    echo "ℹ️  Vous pouvez tuer le processus manuellement :"
    echo "   pkill -f 'bun.*server.ts'"
fi
