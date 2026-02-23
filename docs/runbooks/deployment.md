# Runbook: Déploiement Production

## Pré-déploiement

### 1. Vérifier Prérequis

```bash
# Vérifier tests passent
pnpm test:ci
pnpm test:e2e

# Vérifier linting
pnpm lint
pnpm type-check

# Vérifier branche actuelle
git branch
# Doit être main ou develop
```

### 2. Backup Base de Données

```bash
# Lier à Supabase production
supabase link --project-ref $SUPABASE_PRODUCTION_PROJECT_ID

# Backup automatique (Supabase le fait quotidiennement)
# Vérifier: https://app.supabase.com/project/_/settings/backups

# Backup manuel (optionnel)
supabase db dump -f backup-pre-deploy-$(date +%Y%m%d).sql
```

### 3. Préparer Environnement

```bash
# Créer environnement staging si nécessaire
cp .env.staging .env.local

# Vérifier variables requises
source .env.production
echo $SUPABASE_URL
echo $SENTRY_DSN
```

### 4. Notifier Équipe

```bash
# Envoyer notification Slack
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"text": "🚀 Déploiement NovaConnect prévu dans 30 minutes"}'
```

## Déploiement

### 1. Appliquer Migrations Supabase

```bash
# Appliquer migrations
./scripts/migrate-supabase.sh production

# Vérifier migration réussie
supabase db remote commit

# Générer types
pnpm db:types
```

### 2. Déployer Web App (Vercel)

```bash
# Déployer sur Vercel
./scripts/deploy-web.sh

# Ou manuellement:
cd apps/web
vercel --prod
```

### 3. Déployer Mobile App (EAS)

```bash
# Déployer Android et iOS
./scripts/deploy-mobile.sh all production

# Ou manuellement:
cd apps/mobile
eas build --platform all --profile production
eas submit --platform all
```

### 4. Déployer Gateway (manuel)

```bash
# SSH sur serveur Gateway
ssh gateway@school-server

# Télécharger nouvelle version
wget https://releases.novaconnect.app/gateway/latest.tar.gz

# Arrêter service
sudo systemctl stop novaconnect-gateway

# Extraire et installer
tar -xzf latest.tar.gz
sudo cp novaconnect-gateway /usr/local/bin/

# Démarrer service
sudo systemctl start novaconnect-gateway
sudo systemctl status novaconnect-gateway
```

## Post-déploiement

### 1. Vérifier Health Checks

```bash
# Web app
curl https://novaconnect.app/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Mobile app (API)
curl https://novaconnect.app/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Gateway (si disponible)
curl http://gateway.school.local:8080/health
# Expected: {"status":"ok","mode":"lan"}

# Supabase
curl https://novaconnect.supabase.co/rest/v1/
# Expected: {"information":"Welcome to the Supabase API!"}
```

### 2. Tester Flux Critiques

#### Authentification
- [ ] Login super_admin → dashboard global
- [ ] Login school_admin → dashboard école
- [ ] Login teacher → dashboard prof
- [ ] Login student → dashboard élève
- [ ] Login parent → dashboard parent

#### Présence
- [ ] Prof crée session
- [ ] Prof marque présence
- [ ] Élève scanne QR
- [ ] Fusion présence fonctionne

#### Notes
- [ ] Prof saisit note
- [ ] Admin valide note
- [ ] Admin publie note
- [ ] Élève voit note

#### Paiements
- [ ] Admin crée échéancier
- [ ] Comptable enregistre paiement
- [ ] Reçu généré
- [ ] Solde mis à jour

### 3. Monitorer Sentry

```bash
# Aller sur https://sentry.io/organizations/novaconnect/
# Vérifier:
# - Pas d'erreurs 5xx
# - Pas de crashes app
# - Performance normale
# - Nouveaux errors tracés
```

### 4. Monitorer Logs

```bash
# Supabase logs
supabase logs --project-ref $SUPABASE_PRODUCTION_PROJECT_ID

# Gateway logs (si disponible)
ssh gateway@school-server "tail -f /var/log/novaconnect/gateway.log"

# Vercel logs
vercel logs
```

### 5. Notifier Équipe

```bash
# Notification succès
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"text": "✅ Déploiement NovaConnect terminé avec succès!"}'
```

## Rollback si Échec

### 1. Identifier Problème

```bash
# Vérifier health status
curl https://novaconnect.app/api/health

# Vérifier logs récents
supabase logs --project-ref $SUPABASE_PRODUCTION_PROJECT_ID --limit 50

# Vérifier Sentry pour erreurs
```

### 2. Rollback Web

```bash
# Rollback Vercel
./scripts/rollback.sh web

# Ou manuellement:
vercel rollback --yes
```

### 3. Rollback Mobile

```bash
# Mobile rollback plus complexe
# Option 1: Promouvoir build précédent
# Dashboard EAS → Builds → Sélectionner build précédent → Promote to Production

# Option 2: Nouveau build hotfix
cd apps/mobile
eas build --platform all --profile production
```

### 4. Rollback Database

```bash
# Restaurer backup Supabase
# Dashboard → Database → Backups → Sélectionner backup → Restore

# Ou via CLI
supabase db restore --file backup-pre-deploy-YYYYMMDD.sql
```

### 5. Notifier Équipe Incident

```bash
# Notification incident
curl -X POST $SLACK_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"text": "🚨 Incident déploiement - Rollback en cours"}'

# PagerDuty (si configuré)
# Incident créé automatiquement
```

## Post-Mortem (si incident)

### 1. Documenter Incident

Créer `docs/incidents/YYYY-MM-DD-incident-description.md`:

```markdown
# Incident: [Description]

## Date
YYYY-MM-DD HH:MM UTC

## Impact
- [x] Web app down
- [x] Mobile app down
- [x] Database errors
- Durée: X minutes

## Cause Racine
- Description de ce qui a mal tourné
- Logs snippets
- Screenshots

## Résolution
- Actions immédiates prises
- Rollback effectué
- Correction appliquée

## Actions Préventives
- [ ] Améliorer tests
- [ ] Ajouter monitoring
- [ ] Former équipe
```

### 2. Revue de Processus

- [ ] Qu'est-ce qui a bien fonctionné?
- [ ] Qu'est-ce qui a mal fonctionné?
- [ ] Comment éviter à l'avenir?

### 3. Mettre à Jour Documentation

- [ ] Runbook mis à jour si nécessaire
- [ ] Checklist améliorée
- [ ] Équipe informée des changements

## Checklist Finale

### Avant Déploiement
- [ ] Tests green (CI)
- [ ] Migrations testées en staging
- [ ] Backup base de données créé
- [ ] Équipe notifiée

### Pendant Déploiement
- [ ] Migrations appliquées
- [ ] Web app déployée
- [ ] Mobile app déployée
- [ ] Gateway mise à jour

### Après Déploiement
- [ ] Health checks OK
- [ ] Flux critiques testés
- [ ] Sentry propre
- [ ] Logs normaux
- [ ] Équipe notifiée

### Si Échec
- [ ] Problème identifié
- [ ] Rollback exécuté
- [ ] Incident documenté
- [ ] Actions préventives planifiées

## Contact

- **Lead Technique**: tech-lead@novaconnect.app
- **DevOps**: devops@novaconnect.app
- **Support**: support@novaconnect.app
- **Slack**: #novaconnect-deployments
- **PagerDuty**: #novaconnect-oncall

## Ressources

- [Vercel Documentation](https://vercel.com/docs)
- [Expo EAS Documentation](https://docs.expo.dev/eas)
- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development)
- [Sentry Documentation](https://docs.sentry.io)
