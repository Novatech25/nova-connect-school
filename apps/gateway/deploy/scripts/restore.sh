#!/bin/bash
# ==============================================
# NovaConnect Gateway - Script de Restauration
# ==============================================

set -e

if [ -z "$1" ]; then
    echo "❌ Veuillez spécifier le fichier de backup à restaurer"
    echo "   Usage: $0 /path/to/backup.tar.gz"
    echo ""
    echo "📋 Backups disponibles:"
    ls -lh /var/www/novaconnect-gateway/backups/*.tar.gz 2>/dev/null || echo "   Aucun backup trouvé"
    exit 1
fi

BACKUP_FILE="$1"
GATEWAY_DIR="/var/www/novaconnect-gateway"
TEMP_DIR="/tmp/gateway_restore_$$"

echo "╔════════════════════════════════════════╗"
echo "║  NovaConnect Gateway Restore          ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📦 Backup: $BACKUP_FILE"
echo ""

# Vérifier que le fichier existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Le fichier de backup n'existe pas"
    exit 1
fi

# Arrêter le Gateway
echo "🛑 Arrêt du Gateway..."
pm2 stop novaconnect-gateway 2>/dev/null || systemctl stop novaconnect-gateway 2>/dev/null || true

# Créer le répertoire temporaire
mkdir -p "$TEMP_DIR"

# Extraire le backup
echo "📂 Extraction du backup..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restaurer la base de données
echo "💾 Restauration de la base de données..."
for db_file in "$TEMP_DIR"/*.db.gz; do
    if [ -f "$db_file" ]; then
        db_name=$(basename "$db_file" .db.gz | sed 's/_[0-9]*$//')
        echo "   - $db_name.db"

        # Décompresser et copier
        gunzip -c "$db_file" > "$GATEWAY_DIR/data/$db_name.db"
    fi
done

# Restaurer la licence
if [ -f "$TEMP_DIR"/license_*.json ]; then
    echo "🔑 Restauration du fichier de licence..."
    cp "$TEMP_DIR"/license_*.json "$GATEWAY_DIR/license.json"
fi

# Restaurer la configuration
if [ -f "$TEMP_DIR"/env_* ]; then
    echo "⚙️  Restauration de la configuration..."
    read -p "⚠️  Voulez-vous remplacer le fichier .env actuel ? (o/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        cp "$TEMP_DIR"/env_* "$GATEWAY_DIR/.env"
    else
        echo "ℹ️  Fichier .env conservé"
    fi
fi

# Nettoyer
rm -rf "$TEMP_DIR"

# Redémarrer le Gateway
echo "🚀 Redémarrage du Gateway..."
pm2 restart novaconnect-gateway 2>/dev/null || systemctl start novaconnect-gateway 2>/dev/null || true

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Restauration terminée !            ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📊 Vérifiez que le Gateway fonctionne correctement:"
echo "   curl http://localhost:3001/health"
echo ""
