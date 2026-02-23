#!/bin/bash
# ==============================================
# NovaConnect Gateway - Certificat Auto-signé (Développement)
# ==============================================
# À utiliser uniquement pour le développement ou les tests
# Ne PAS utiliser en production
# ==============================================

set -e

DOMAIN=${1:-"gateway.local"}

echo "╔════════════════════════════════════════╗"
echo "║  Certificat SSL Auto-signé             ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "⚠️  ATTENTION: Certificat auto-signé uniquement pour développement"
echo ""

# Créer le répertoire pour les certificats
mkdir -p /etc/nginx/ssl

# Générer le certificat auto-signé
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/gateway.key \
    -out /etc/nginx/ssl/gateway.crt \
    -subj "/C=FR/ST=State/L=City/O=Organization/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost"

# Définir les permissions
chmod 600 /etc/nginx/ssl/gateway.key
chmod 644 /etc/nginx/ssl/gateway.crt

echo "✅ Certificat auto-signé généré"
echo ""
echo "📁 Fichiers créés :"
echo "   - /etc/nginx/ssl/gateway.crt"
echo "   - /etc/nginx/ssl/gateway.key"
echo ""
echo "🔧 Mettez à jour votre configuration Nginx pour utiliser ces fichiers :"
echo "   ssl_certificate /etc/nginx/ssl/gateway.crt;"
echo "   ssl_certificate_key /etc/nginx/ssl/gateway.key;"
echo ""
echo "⚠️  Les navigateurs afficheront une erreur de sécurité (normal pour un certificat auto-signé)"
echo ""
