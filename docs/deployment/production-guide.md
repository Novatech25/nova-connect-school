# Guide Déploiement Production NovaConnect

## Prérequis

### Comptes Requis

- [x] **Vercel** (https://vercel.com) - Hébergement web app
- [x] **Expo** (https://expo.dev) - Build et distribution mobile
- [x] **Supabase** (https://supabase.com) - Backend as a Service
- [x] **Sentry** (https://sentry.io) - Monitoring erreurs
- [x] **GitHub** (https://github.com) - CI/CD et code hosting

### Outils Locaux

```bash
# Installer CLI tools
npm install -g vercel
npm install -g @supabase/supabase-js
npm install -g eas-cli

# Vérifier installations
vercel --version
supabase --version
eas --version
```

## Configuration Initiale

### 1. Vercel Setup

```bash
# Se connecter à Vercel
vercel login

# Lier projet
cd apps/web
vercel link

# Configurer environnement
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
vercel env add SENTRY_DSN production
vercel env add SENTRY_AUTH_TOKEN production
```

### 2. Expo EAS Setup

```bash
# Se connecter à Expo
eas login

# Créer projet EAS
cd apps/mobile
eas init

# Configurer builds
eas build:configure

# Ajouter variables environnement
eas build --platform android --profile development
```

### 3. Supabase Setup

```bash
# Créer projet Supabase production
# Via dashboard: https://app.supabase.com/new

# Lier projet local
supabase link --project-ref $SUPABASE_PRODUCTION_PROJECT_ID

# Activer required extensions
supabase db execute "
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
"

# Appliquer migrations
supabase db push

# Générer types
pnpm db:types
```

### 4. Sentry Setup

```bash
# Créer projet Sentry
# Via dashboard: https://sentry.io/settings/projects/new/

# Configurer integration Vercel
# Dashboard Sentry → Settings → Integrations → Vercel

# Configurer integration Expo
# Dashboard Sentry → Settings → Integrations → Expo
```

## Déploiement Web

### Premier Déploiement

```bash
# Build et déployer
cd apps/web
vercel --prod

# Attendre fin du déploiement
# URL: https://novaconnect.vercel.app
```

### Configurer Domaine Custom

```bash
# Ajouter domaine dans Vercel Dashboard
# Domains → Add Domain → novaconnect.app

# Configurer DNS chez provider
# Type: CNAME
# Name: novaconnect
# Value: cname.vercel-dns.com

# Attendre propagation DNS (max 48h)
# Vercel fournira certificat SSL automatiquement
```

### Déploiements Suivants

```bash
# Via script
./scripts/deploy-web.sh

# Ou manuellement
git push origin main
# CI/CD déploie automatiquement via GitHub Actions
```

## Déploiement Mobile

### Configuration Android

```bash
# Créer keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/keystore.jks \
  -alias novaconnect \
  -keyalg RSA -keysize 2048 -validity 10000

# Ajouter dans EAS
eas build --platform android --profile production
```

### Configuration iOS

```bash
# Créer Apple Developer account
# https://developer.apple.com/programs/enroll/

# Configurer app dans App Store Connect
# https://appstoreconnect.apple.com

# Ajouter certificate et provisioning profile
# Via EAS dashboard: https://expo.dev/accounts/novaconnect/projects/novaconnect

eas build --platform ios --profile production
```

### Soumission Stores

```bash
# Android - Google Play
eas submit --platform android \
  --latest \
  --service-account-key-path ./google-service-account.json

# iOS - App Store
eas submit --platform ios \
  --latest \
  --apple-id your-apple-id@example.com \
  --asc-app-id 1234567890
```

### Updates OTA (Over-The-Air)

```bash
# Pour updates sans passer par stores
eas update --branch production \
  --message "Bug fixes and performance improvements"
```

## Déploiement Gateway

### Installation Serveur

```bash
# Prérequis: Ubuntu 22.04 LTS
# SSH sur serveur école
ssh admin@school-server

# Installer Bun
curl -fsSL https://bun.sh/install | bash

# Cloner repository
git clone https://github.com/novaconnect/app.git
cd app/apps/gateway

# Installer dépendances
bun install

# Configuration
cp .env.example .env
nano .env
# Ajouter: SUPABASE_URL, SUPABASE_ANON_KEY, LICENSE_KEY

# Build
bun run build

# Créer service systemd
sudo nano /etc/systemd/system/novaconnect-gateway.service
```

Contenu `novaconnect-gateway.service`:

```ini
[Unit]
Description=NovaConnect Gateway
After=network.target

[Service]
Type=simple
User=gateway
WorkingDirectory=/opt/novaconnect/gateway
ExecStart=/usr/local/bin/bun run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Démarrer service
sudo systemctl daemon-reload
sudo systemctl enable novaconnect-gateway
sudo systemctl start novaconnect-gateway
sudo systemctl status novaconnect-gateway
```

### Activation Licence

```bash
# Générer licence (super admin)
# Via dashboard Supabase ou API

# Activer sur Gateway
curl -X POST http://localhost:8080/api/licenses/activate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "NOVA-XXXX-XXXX-XXXX-XXXX",
    "school_id": "school-uuid"
  }'
```

## Migrations Base de Données

### Workflow Développement

```bash
# Créer nouvelle migration
supabase migration new add_feature_table

# Éditer migration
supabase/migrations/20240115120000_add_feature_table.sql

# Tester localement
supabase db reset

# Pousser vers Supabase
supabase db push
```

### Workflow Production

```bash
# Via script
./scripts/migrate-supabase.sh production

# Ou manuellement
supabase link --project-ref $SUPABASE_PRODUCTION_PROJECT_ID
supabase db push

# Vérifier migration
supabase db remote changes
```

### Rollback Strategy

```bash
# Toujours créer migration réversible
-- Exemple migration UP
CREATE TABLE new_table (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- Exemple migration DOWN
DROP TABLE IF EXISTS new_table;

# Rollback manuel si nécessaire
supabase db rollback
```

## Monitoring

### Sentry Configuration

```typescript
// Dashboard Sentry → Settings → Projects → NovaConnect

// Alertes configurées:
// - Errors: > 10/minute → Slack + Email
// - Performance: p95 > 2s → Slack
// - Crashes: > 5/minute → PagerDuty

// Integrations:
// - Slack: #novaconnect-errors
// - PagerDuty: NovaConnect service
// - GitHub: Auto-create issues
```

### Dashboards

```bash
# Performance Dashboard
# https://sentry.io/organizations/novaconnect/performance/

# Métriques clés:
// - Response time (p50, p95, p99)
// - Throughput (req/s)
// - Error rate (%)
// - User sessions

# Error Dashboard
# https://sentry.io/organizations/novaconnect/issues/

# Filtrer par:
// - Environment (production, staging)
// - Release (version)
// - Browser/device
```

### Alertes

```yaml
# Alertes Sentry configurées:

Critical:
  - name: "5xx Errors Spike"
    condition: "error:category:server > 50 in 5m"
    action: PagerDuty + Slack #critical

  - name: "App Crashes"
    condition: "event.type:exception > 10 in 1m"
    action: PagerDuty + Slack #critical

Warning:
  - name: "High Latency"
    condition: "transaction.duration > 2000ms for > 5% of requests"
    action: Slack #warnings

  - name: "Database Connection Pool Exhausted"
    condition: "supabase:pool_usage > 90%"
    action: Slack #warnings
```

## Maintenance

### Updates Réguliers

```bash
# Dependencies (hebdomadaire)
pnpm update
pnpm audit fix

# Tests avant merge
pnpm test:ci
pnpm test:e2e

# Déploiement staging
pnpm build:web
vercel --env staging
```

### Backups

```bash
# Supabase backups automatiques quotidiens
# Rétention: 7 jours (tier Pro), 30 jours (tier Enterprise)

# Export manuel (mensuel)
supabase db dump -f backup-$(date +%Y%m%d).sql

# Gateway database backup
ssh gateway@school-server "sqlite3 /var/lib/novaconnect/gateway.db .dump > backup-$(date +%Y%m%d).sql"
```

### Scaling

```bash
# Web: Vercel auto-scale (serverless)
# Aucune action requise

# Database: Upgrader tier Supabase
# Dashboard → Settings → Billing → Change tier

# Gateway: Multi-instance
# Load balancer: nginx
# Instances: 2+ serveurs avec même licence
```

## Sécurité

### Headers HTTP

```typescript
// Configuré dans next.config.js et vercel.json

// Headers appliqués:
// - Strict-Transport-Security: max-age=31536000
// - X-Frame-Options: SAMEORIGIN
// - X-Content-Type-Options: nosniff
// - X-XSS-Protection: 1; mode=block
// - Content-Security-Policy: default-src 'self'
```

### Secrets Management

```bash
# Jamais committer les secrets
# .env dans .gitignore

# Production: utiliser environment variables
# Vercel Environment Variables
# Expo EAS Secrets
# Supabase Secrets (via CLI)

# Rotation des secrets (trimestrielle)
# - Supabase keys
# - Sentry DSN
# - Gateway licenses
```

### HTTPS Everywhere

```bash
# Web: Vercel fournit certificat SSL automatique (Let's Encrypt)

# Mobile: HTTPS requis pour API calls
# App Transport Security (iOS) configuré

# Gateway: Certificat SSL requis
# Utiliser Let's Encrypt ou certificat custom
```

## Support et Troubleshooting

### Ressources

- **Documentation**: https://docs.novaconnect.app
- **Status Page**: https://status.novaconnect.app
- **Support Email**: support@novaconnect.app
- **Slack**: #novaconnect-support
- **GitHub Issues**: https://github.com/novaconnect/app/issues

### Common Issues

```bash
# Web app ne démarre pas
vercel logs
# Vérifier variables env

# Mobile app crash
# Vérifier Sentry pour crash logs
# Vérifier Expo build logs

# Gateway offline
ssh gateway@school-server
systemctl status novaconnect-gateway
journalctl -u novaconnect-gateway -n 100

# Sync bloquée
# Vérifier Supabase logs
# Vérifier queue size dans dashboard admin
```

## Conclusion

Ce guide couvre l'ensemble du processus de déploiement production de NovaConnect. Pour toute question ou problème, contacter l'équipe technique.

**Prochaine étape**: Voir [Update Guide](./update-guide.md) pour les mises à jour post-production.
