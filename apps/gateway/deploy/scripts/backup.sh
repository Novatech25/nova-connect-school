#!/bin/bash
# ==============================================
# NovaConnect Gateway - Script de Backup
# ==============================================

set -e

# Configuration
GATEWAY_DIR="/var/www/novaconnect-gateway"
BACKUP_DIR="/var/www/novaconnect-gateway/backups"
DATA_DIR="$GATEWAY_DIR/data"
RETENTION_DAYS=30

# Créer le répertoire de backup
mkdir -p "$BACKUP_DIR"

# Date du backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="gateway_backup_$DATE"

echo "╔════════════════════════════════════════╗"
echo "║  NovaConnect Gateway Backup           ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📅 Date: $DATE"
echo "📁 Répertoire: $BACKUP_DIR"
echo ""

# 1. Backup de la base de données SQLite
echo "💾 Backup de la base de données..."
for db_file in "$DATA_DIR"/*.db; do
    if [ -f "$db_file" ]; then
        db_name=$(basename "$db_file" .db)
        echo "   - $db_name.db"

        # Utiliser sqlite3 pour créer un backup propre
        sqlite3 "$db_file" ".backup '$BACKUP_DIR/${db_name}_$DATE.db'"

        # Compresser
        gzip "$BACKUP_DIR/${db_name}_$DATE.db"
    fi
done

# 2. Backup du fichier de licence
if [ -f "$GATEWAY_DIR/license.json" ]; then
    echo "🔑 Backup du fichier de licence..."
    cp "$GATEWAY_DIR/license.json" "$BACKUP_DIR/license_$DATE.json"
fi

# 3. Backup de la configuration
if [ -f "$GATEWAY_DIR/.env" ]; then
    echo "⚙️  Backup de la configuration..."
    cp "$GATEWAY_DIR/.env" "$BACKUP_DIR/env_$DATE"
fi

# 4. Créer une archive complète
echo "📦 Création de l'archive complète..."
tar -czf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" \
    -C "$BACKUP_DIR" \
    "*_$DATE.db.gz" \
    "license_$DATE.json" \
    "env_$DATE" 2>/dev/null || true

# Nettoyer les fichiers temporaires
rm -f "$BACKUP_DIR"/*_$DATE.db.gz
rm -f "$BACKUP_DIR"/license_$DATE.json
rm -f "$BACKUP_DIR"/env_$DATE

# 5. Nettoyer les anciens backups
echo "🧹 Nettoyage des anciens backups (>$RETENTION_DAYS jours)..."
find "$BACKUP_DIR" -name "gateway_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# 6. Afficher le résumé
echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Backup terminé !                   ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📦 Archive: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"

# Afficher la taille
SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)
echo "📊 Taille: $SIZE"
echo ""
echo "💡 Pour restaurer:"
echo "   tar -xzf $BACKUP_DIR/${BACKUP_NAME}.tar.gz -C /tmp"
echo ""
