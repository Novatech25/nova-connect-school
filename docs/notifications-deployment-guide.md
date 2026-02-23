# Guide de déploiement du Système de Notifications

Ce guide détaille les étapes pour déployer le système de notifications multi-canal de NovaConnect en production.

## Prérequis

- Compte Supabase (cloud ou self-hosted)
- Compte Resend (pour les emails)
- Compte Twilio (pour SMS/WhatsApp)
- Compte Expo (pour les push notifications)
- Accès administrateur à la base de données

## 1. Configuration des services tiers

### 1.1 Resend (Email)

1. Créer un compte sur https://resend.com/
2. Générer une API key :
   - Allez dans Settings > API Keys
   - Cliquez sur "Create API Key"
   - Copiez la clé (commence par `re_`)

3. Configurer le domaine d'envoi :
   - Allez dans Settings > Domains
   - Ajoutez votre domaine (ex: `novaconnect.app`)
   - Configurez les enregistrements DNS SPF, DKIM, etc.

4. Notez l'email d'envoi (ex: `notifications@novaconnect.app`)

### 1.2 Twilio (SMS/WhatsApp)

1. Créer un compte sur https://www.twilio.com/
2. Obtenir les credentials :
   - Dashboard > Project Info
   - Copiez le `Account SID` (commence par `AC`)
   - Copiez le `Auth Token`

3. Configurer un numéro téléphone :
   - Allez dans Phone Numbers > Buy a Number
   - Choisissez un numéro avec capacités SMS
   - Achetez le numéro
   - Copiez le numéro (format E.164 : `+1234567890`)

4. Activer WhatsApp (optionnel) :
   - Allez dans Messaging > Try it out > Send a WhatsApp message
   - Suivez les étapes pour configurer WhatsApp Business API
   - Notez le numéro WhatsApp (format : `whatsapp:+1234567890`)

### 1.3 Expo (Push Notifications)

1. Créer un compte sur https://expo.dev/
2. Créer un projet :
   - Allez dans Projects > Create Project
   - Liez-le à votre app mobile
   - Copiez le `Project ID`

3. Générer un Access Token :
   - Allez dans Settings > Access Tokens
   - Cliquez sur "Create Token"
   - Cochez les permissions "Notifications:Send"
   - Copiez le token

## 2. Configuration Supabase

### 2.1 Variables d'environnement locales

Ajoutez les variables à votre fichier `.env` :

```env
# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=notifications@novaconnect.app

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# Expo
EXPO_ACCESS_TOKEN=xxxxx

# Supabase (si cloud)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

### 2.2 Variables d'environnement Supabase Cloud

Allez dans Supabase Dashboard > Edge Functions > Secrets et ajoutez les mêmes variables :

```bash
RESEND_API_KEY
RESEND_FROM_EMAIL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_WHATSAPP_NUMBER
EXPO_ACCESS_TOKEN
```

## 3. Déploiement des migrations SQL

### 3.1 Activer l'extension pg_net (si pas déjà fait)

```sql
-- Dans Supabase Dashboard > SQL Editor
CREATE EXTENSION IF NOT EXISTS net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 3.2 Appliquer les migrations

```bash
# Depuis la racine du projet
supabase db push
```

Ou manuellement dans le SQL Editor :

```sql
-- Exécuter le contenu de :
-- supabase/migrations/20250201000001_create_grades_notifications_triggers.sql
-- supabase/migrations/20250201000002_add_retry_to_notification_logs.sql
```

### 3.3 Configurer le cron job pour retry

```sql
-- Créer le cron job pour le retry automatique
SELECT cron.schedule(
  'retry-failed-notifications',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url := format('%s/functions/v1/retry-failed-notifications', current_setting('app.supabase_url')),
      headers := jsonb_build_object(
        'Authorization',
        format('Bearer %s', current_setting('app.supabase_service_role_key')),
        'Content-Type',
        'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
```

Vérifier que le cron job est actif :

```sql
SELECT * FROM cron.job WHERE jobname = 'retry-failed-notifications';
```

## 4. Déploiement des Edge Functions

### 4.1 Déployer toutes les nouvelles fonctions

```bash
# Depuis la racine du projet
supabase functions deploy send-email-notification
supabase functions deploy send-sms-notification
supabase functions deploy retry-failed-notifications
```

### 4.2 Mettre à jour la fonction existante

```bash
supabase functions deploy send-notification
```

### 4.3 Vérifier le déploiement

Dans Supabase Dashboard > Edge Functions, vérifiez que les 4 fonctions sont listées :
- ✅ send-notification
- ✅ send-email-notification
- ✅ send-sms-notification
- ✅ retry-failed-notifications

## 5. Configuration des préférences par défaut

Les préférences par défaut sont définies dans :

**Web** : `apps/web/src/app/api/notifications/preferences/default/route.ts`

Vous pouvez personnaliser les canaux activés par type de notification :

```typescript
const DEFAULT_CHANNELS = {
  grade_posted: ['in_app', 'push', 'email'],
  assignment_added: ['in_app', 'push', 'email'],
  // ... etc
};
```

## 6. Tests

### 6.1 Tester les notifications in-app

```sql
-- Insérer une notification de test
INSERT INTO notifications (school_id, user_id, type, title, body, channels)
VALUES (
  'votre-school-id',
  'votre-user-id',
  'grade_posted',
  'Test notification',
  'Ceci est une notification de test',
  ARRAY['in_app']
);
```

Vérifiez qu'elle apparaît dans l'interface web/mobile.

### 6.2 Tester les push notifications

```bash
# Appeler l'Edge Function avec curl
curl -X POST https://votre-projet.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer VOTRE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "notifications": [
      {
        "userId": "votre-user-id",
        "type": "grade_posted",
        "title": "Test Push",
        "body": "Test de notification push",
        "channels": ["push"]
      }
    ],
    "schoolId": "votre-school-id"
  }'
```

### 6.3 Tester les emails

```bash
curl -X POST https://votre-projet.supabase.co/functions/v1/send-email-notification \
  -H "Authorization: Bearer VOTRE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "votre-email@test.com",
    "subject": "Test Email",
    "html": "<p>Ceci est un email de test</p>"
  }'
```

Vérifiez que vous recevez l'email.

### 6.4 Tester les SMS

```bash
curl -X POST https://votre-projet.supabase.co/functions/v1/send-sms-notification \
  -H "Authorization: Bearer VOTRE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "message": "Test SMS",
    "channel": "sms"
  }'
```

Vérifiez que vous recevez le SMS.

### 6.5 Tester le retry automatique

```sql
-- Créer des logs échoués pour tester
INSERT INTO notification_logs (notification_id, channel, status, sent_at, retry_count)
VALUES
  ('test-notification-id', 'email', 'failed', NOW(), 0);

-- Attendre 10 minutes (ou forcer le cron job)
SELECT cron.run_job('retry-failed-notifications');

-- Vérifier que retry_count a augmenté
SELECT * FROM notification_logs WHERE notification_id = 'test-notification-id';
```

## 7. Monitoring

### 7.1 Tableau de bord

Créez un tableau de bord dans Supabase avec les graphiques :

- Notifications créées par jour
- Taux de succès par canal
- Notifications échouées
- Coûts estimés SMS/WhatsApp

### 7.2 Alertes

Configurez des alertes pour :

- Taux d'échec > 10% sur une période
- Nombre de notifications échouées > 100/heure
- Crédits Twilio bas

## 8. Maintenance

### 8.1 Vérifier les logs régulièrement

```sql
-- Voir les erreurs récentes
SELECT * FROM notification_logs
WHERE status = 'failed'
ORDER BY sent_at DESC
LIMIT 50;
```

### 8.2 Nettoyer les anciennes notifications

```sql
-- Archiver les notifications de plus de 90 jours
DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '90 days'
AND read_at IS NOT NULL;
```

### 8.3 Mettre à jour les coûts

Surveillez vos coûts Twilio/Resend et ajustez si nécessaire :

- Limiter les SMS pour les notifications non critiques
- Utiliser des templates WhatsApp approuvés (moins cher)
- Configurer des limites quotidiennes

## 9. Dépannage

### Problème : Emails non reçus

1. Vérifier les logs Resend : https://resend.com/dashboard/logs
2. Vérifier la réputation du domaine
3. Vérifier les dossiers spam/promotions

### Problème : Push notifications non reçues

1. Vérifier que les tokens push sont à jour
2. Vérifier les permissions de notification sur l'appareil
3. Tester avec Expo Push Tool

### Problème : SMS non reçus

1. Vérifier le format du numéro (E.164)
2. Vérifier le solde Twilio
3. Vérifier les logs Twilio

### Problème : WhatsApp non reçus

1. Vérifier que le numéro est inscrit à WhatsApp
2. Vérifier que le template est approuvé
3. Vérifier les logs Twilio pour les erreurs

## 10. Sécurité

### 10.1 Ne jamais exposer les clés API

- N'utilisez jamais `SUPABASE_SERVICE_ROLE_KEY` dans le code client
- Utilisez toujours les RLS policies pour protéger les données
- Limitez les permissions des tokens Expo

### 10.2 Rate limiting

Configurez des rate limits pour éviter les abus :

```sql
-- Créer une politique de rate limiting
CREATE TABLE notification_rate_limits (
  user_id UUID PRIMARY KEY,
  notification_count INTEGER DEFAULT 0,
  last_reset TIMESTAMPTZ DEFAULT NOW()
);
```

## 11. Support

Pour toute question ou problème :

- Documentation complète : [docs/notifications-system.md](./notifications-system.md)
- Issues GitHub : https://github.com/votre-org/novaconnect/issues
- Support email : support@novaconnect.app

---

**Félicitations !** Votre système de notifications multi-canal est maintenant déployé et opérationnel 🎉
