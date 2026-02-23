#!/bin/bash
# ==============================================
# NovaConnect Gateway - Script de configuration SSL
# Let's Encrypt automatique
# ==============================================

set -e

DOMAIN=${1:-"gateway.your-domain.com"}
EMAIL=${2:-"admin@your-domain.com"}

echo "╔════════════════════════════════════════╗"
echo "║  Configuration SSL pour $DOMAIN     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Vérifier que le domaine est configuré
if [ "$DOMAIN" = "gateway.your-domain.com" ]; then
    echo "❌ Veuillez spécifier votre domaine réel"
    echo "   Usage: $0 votre-domaine.com email@domaine.com"
    exit 1
fi

# Installer Certbot
echo "📦 Installation de Certbot..."
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Créer le répertoire pour le challenge webroot
echo "📁 Création du répertoire webroot..."
mkdir -p /var/www/certbot

# Mettre à jour la configuration Nginx avec le bon domaine
echo "🔧 Mise à jour de la configuration Nginx..."
sed -i "s/gateway\.your-domain\.com/$DOMAIN/g" /etc/nginx/sites-available/novaconnect-gateway

# Tester la configuration Nginx
echo "🧪 Test de la configuration Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuration Nginx valide"
    systemctl reload nginx
else
    echo "❌ Configuration Nginx invalide"
    exit 1
fi

# Obtenir le certificat SSL
echo "🔐 Obtention du certificat SSL..."
certbot certonly --webroot \
    -w /var/www/certbot \
    -d $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email

if [ $? -eq 0 ]; then
    echo "✅ Certificat SSL obtenu avec succès"

    # Activer la configuration HTTPS complète
    sed -i 's/# ssl_certificate/ssl_certificate/g' /etc/nginx/sites-available/novaconnect-gateway
    sed -i 's/# ssl_certificate_key/ssl_certificate_key/g' /etc/nginx/sites-available/novaconnect-gateway

    # Recharger Nginx
    nginx -t && systemctl reload nginx

    echo "✅ Configuration HTTPS activée"

    # Configurer le renouvellement automatique
    echo "🔄 Configuration du renouvellement automatique..."
    (crontab -l 2>/dev/null; echo "0 0,12 * * * root certbot renew --quiet --deploy-hook 'systemctl reload nginx'") | crontab -

    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║  ✅ Configuration SSL terminée !      ║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "🌐 Votre Gateway est maintenant accessible en HTTPS :"
    echo "   https://$DOMAIN"
    echo ""
    echo "📊 Admin interface :"
    echo "   https://$DOMAIN/admin"
    echo ""
    echo "🔄 Le certificat sera renouvelé automatiquement"
    echo ""
else
    echo "❌ Échec de l'obtention du certificat SSL"
    echo "ℹ️  Vérifiez que:"
    echo "   - Le domaine pointe vers ce serveur"
    echo "   - Le port 80 est accessible"
    echo "   - La configuration DNS est correcte"
    exit 1
fi
