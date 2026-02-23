#!/bin/bash
# ==============================================
# NovaConnect Gateway - Monitoring Dashboard
# Affiche en temps réel les statistiques du Gateway
# ==============================================

# Configuration
GATEWAY_URL="http://localhost:3001"
LOG_FILE="/var/www/novaconnect-gateway/logs/gateway.log"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Fonction pour afficher une section
print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Fonction pour afficher une métrique
print_metric() {
    local label=$1
    local value=$2
    local status=$3

    case $status in
        "ok")
            color=$GREEN
            icon="✅"
            ;;
        "warning")
            color=$YELLOW
            icon="⚠️ "
            ;;
        "error")
            color=$RED
            icon="❌"
            ;;
        *)
            color=$NC
            icon="ℹ️ "
            ;;
    esac

    echo -e "${icon} ${BOLD}$label:${NC} $color$value${NC}"
}

while true; do
    clear

    echo -e "${BOLD}${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║  NovaConnect Gateway Monitoring       ║${NC}"
    echo -e "${BOLD}${BLUE}╚════════════════════════════════════════╝${NC}"
    echo -e "${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"

    # 1. Statut du service
    print_section "📊 Statut du Service"

    if pgrep -f "bun.*server.ts" > /dev/null; then
        UPTIME=$(ps -o etime= -p $(pgrep -f "bun.*server.ts" | head -1) | tr -d ' ')
        print_metric "Statut" "En cours d'exécution" "ok"
        print_metric "Uptime" "$UPTIME" "ok"
    else
        print_metric "Statut" "Arrêté" "error"
    fi

    # 2. Statut HTTP
    print_section "🌐 HTTP Endpoints"

    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health" 2>/dev/null)
    if [ "$HEALTH_STATUS" = "200" ]; then
        print_metric "Health check" "OK ($HEALTH_STATUS)" "ok"
    else
        print_metric "Health check" "FAILED ($HEALTH_STATUS)" "error"
    fi

    # 3. Statistiques de synchronisation
    print_section "🔄 Synchronisation"

    SYNC_STATUS=$(curl -s "$GATEWAY_URL/api/sync/status" 2>/dev/null)
    if [ -n "$SYNC_STATUS" ]; then
        PENDING=$(echo "$SYNC_STATUS" | grep -o '"pending":[0-9]*' | cut -d':' -f2)
        SYNCED=$(echo "$SYNC_STATUS" | grep -o '"synced":[0-9]*' | cut -d':' -f2)
        FAILED=$(echo "$SYNC_STATUS" | grep -o '"failed":[0-9]*' | cut -d':' -f2)

        print_metric "En attente" "$PENDING" $(([ "$PENDING" -gt 100 ] && echo "warning" || echo "ok"))
        print_metric "Synchronisés" "$SYNCED" "ok"
        print_metric "Échoués" "$FAILED" $(([ "$FAILED" -gt 0 ] && echo "error" || echo "ok"))
    else
        print_metric "Sync status" "Non disponible" "warning"
    fi

    # 4. Base de données
    print_section "💾 Base de données"

    DB_FILE=$(find /var/www/novaconnect-gateway/data -name "*.db" -type f 2>/dev/null | head -n 1)
    if [ -n "$DB_FILE" ]; then
        DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
        print_metric "Fichier" "$(basename $DB_FILE)" "ok"
        print_metric "Taille" "$DB_SIZE" "ok"

        # Compter les enregistrements
        RECORDS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM event_log" 2>/dev/null)
        if [ -n "$RECORDS" ]; then
            print_metric "Events log" "$RECORDS enregistrements" "ok"
        fi
    else
        print_metric "Base de données" "Non trouvée" "error"
    fi

    # 5. Ressources système
    print_section "💻 Ressources Système"

    # CPU
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    print_metric "CPU" "${CPU_USAGE}%" $(($(echo "$CPU_USAGE < 80" | bc -l) && echo "ok" || echo "warning"))

    # Mémoire
    MEM_USAGE=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100)}')
    print_metric "Mémoire" "${MEM_USAGE}%" $(($(echo "$MEM_USAGE < 80" | bc -l) && echo "ok" || echo "warning"))

    # Disque
    DISK_USAGE=$(df /var/www/novaconnect-gateway | tail -1 | awk '{print $5}' | sed 's/%//')
    print_metric "Disque" "${DISK_USAGE}%" $(([ "$DISK_USAGE" -lt 80 ] && echo "ok" || ([ "$DISK_USAGE" -lt 90 ] && echo "warning" || echo "error")))

    # 6. Logs récents
    print_section "📝 Logs Récents"

    if [ -f "$LOG_FILE" ]; then
        echo -e "${YELLOW}Dernières lignes:${NC}"
        tail -5 "$LOG_FILE" | while read line; do
            echo "  $line"
        done
    else
        echo "  Aucun log disponible"
    fi

    # Footer
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Actualisation dans 5 secondes... (Ctrl+C pour quitter)${NC}"

    sleep 5
done
