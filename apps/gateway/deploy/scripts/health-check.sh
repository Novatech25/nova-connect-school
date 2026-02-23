#!/bin/bash
# ==============================================
# NovaConnect Gateway - Health Check Script
# ==============================================

# Configuration
GATEWAY_URL=${1:-"http://localhost:3001"}
LOG_FILE="/var/www/novaconnect-gateway/logs/health-check.log"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════╗"
echo "║  NovaConnect Gateway Health Check      ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "🔗 URL: $GATEWAY_URL"
echo "🕐 $(date)"
echo ""

# Fonction pour logger
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Fonction de vérification
check_service() {
    local name=$1
    local url=$2
    local expected=${3:-"200"}

    echo -n "🔍 $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)

    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✅ OK${NC} ($response)"
        log "✅ $name: OK ($response)"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} ($response, expected $expected)"
        log "❌ $name: FAILED ($response, expected $expected)"
        return 1
    fi
}

# Variables pour le résumé
total_checks=0
failed_checks=0

# 1. Vérifier le endpoint de health
total_checks=$((total_checks + 1))
check_service "Health Endpoint" "$GATEWAY_URL/health" "200" || failed_checks=$((failed_checks + 1))

# 2. Vérifier l'interface admin
total_checks=$((total_checks + 1))
check_service "Admin Interface" "$GATEWAY_URL/admin" "200" || failed_checks=$((failed_checks + 1))

# 3. Vérifier que le processus tourne
echo -n "🔍 Processus... "
if pgrep -f "bun.*server.ts" > /dev/null || pgrep -f "pm2.*novaconnect-gateway" > /dev/null; then
    echo -e "${GREEN}✅ Running${NC}"
    log "✅ Processus: Running"
else
    echo -e "${RED}❌ Not running${NC}"
    log "❌ Processus: Not running"
    failed_checks=$((failed_checks + 1))
fi
total_checks=$((total_checks + 1))

# 4. Vérifier la base de données
echo -n "🔍 Base de données... "
DB_FILE=$(find /var/www/novaconnect-gateway/data -name "*.db" -type f 2>/dev/null | head -n 1)
if [ -n "$DB_FILE" ]; then
    if sqlite3 "$DB_FILE" "PRAGMA integrity_check" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        log "✅ Base de données: OK"
    else
        echo -e "${RED}❌ Corrupted${NC}"
        log "❌ Base de données: Corrupted"
        failed_checks=$((failed_checks + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Not found${NC}"
    log "⚠️  Base de données: Not found"
fi
total_checks=$((total_checks + 1))

# 5. Vérifier l'espace disque
echo -n "🔍 Espace disque... "
DISK_USAGE=$(df /var/www/novaconnect-gateway | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${GREEN}✅ OK${NC} (${DISK_USAGE}% utilisé)"
    log "✅ Espace disque: OK (${DISK_USAGE}%)"
else
    echo -e "${RED}❌ LOW SPACE${NC} (${DISK_USAGE}% utilisé)"
    log "❌ Espace disque: LOW (${DISK_USAGE}%)"
    failed_checks=$((failed_checks + 1))
fi
total_checks=$((total_checks + 1))

# 6. Vérifier la mémoire
echo -n "🔍 Mémoire... "
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
if [ "$MEM_USAGE" -lt 90 ]; then
    echo -e "${GREEN}✅ OK${NC} (${MEM_USAGE}% utilisé)"
    log "✅ Mémoire: OK (${MEM_USAGE}%)"
else
    echo -e "${YELLOW}⚠️  HIGH${NC} (${MEM_USAGE}% utilisé)"
    log "⚠️  Mémoire: HIGH (${MEM_USAGE}%)"
fi
total_checks=$((total_checks + 1))

# 7. Vérifier les logs récents
echo -n "🔍 Logs d'erreur... "
if [ -f "/var/www/novaconnect-gateway/logs/error.log" ]; then
    ERROR_COUNT=$(tail -100 /var/www/novaconnect-gateway/logs/error.log 2>/dev/null | grep -i "error" | wc -l)
    if [ "$ERROR_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ No errors${NC}"
        log "✅ Logs: No errors"
    else
        echo -e "${YELLOW}⚠️  $ERROR_COUNT errors found${NC}"
        log "⚠️  Logs: $ERROR_COUNT errors found"
    fi
else
    echo -e "${GREEN}✅ No error log${NC}"
fi
total_checks=$((total_checks + 1))

# Résumé
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $failed_checks -eq 0 ]; then
    echo -e "${GREEN}✅ Tous les checks sont OK ($total_checks/$total_checks)${NC}"
    log "✅ Health check: OK ($total_checks/$total_checks)"
    exit 0
else
    echo -e "${RED}❌ $failed_checks/$total_checks checks ont échoué${NC}"
    log "❌ Health check: FAILED ($failed_checks/$total_checks)"
    exit 1
fi
