# Guide de Configuration des Notifications de Présence

Ce guide explique comment configurer et tester les notifications automatiques aux parents pour les absences et retards des élèves.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROCESSUS DE NOTIFICATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Professeur marque un élève absent/retard                    │
│           ↓                                                      │
│  2. Trigger SQL notify_parents_on_absence()                     │
│     - Crée notification in-app                                  │
│     - Appelle call_attendance_edge_function()                   │
│           ↓                                                      │
│  3. Edge Function send-attendance-notification                  │
│     - Récupère infos élève et parents                           │
│     - Envoie notifications push (Expo)                          │
│     - Envoie emails (si activé)                                 │
│     - Log les résultats                                         │
│           ↓                                                      │
│  4. Parents reçoivent la notification                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tables Impliquées

| Table | Description |
|-------|-------------|
| `attendance_records` | Enregistrements de présence |
| `attendance_sessions` | Sessions de prise de présence |
| `notifications` | Notifications in-app créées |
| `push_tokens` | Tokens Expo pour push notifications |
| `notification_logs` | Logs des envois |
| `notification_preferences` | Préférences des utilisateurs |

## Configuration Requise

### 1. Variables d'Environnement

Ajoutez ces variables dans votre projet Supabase :

```bash
# Supabase
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# Expo (pour push notifications)
EXPO_ACCESS_TOKEN=votre-expo-access-token

# Email (Resend)
RESEND_API_KEY=re_votre-cle
RESEND_FROM_EMAIL=notifications@ecole.com
```

### 2. Déployer les Edge Functions

```bash
# Déployer la fonction de notification de présence
supabase functions deploy send-attendance-notification

# Déployer la fonction d'envoi d'email
supabase functions deploy send-email-notification
```

### 3. Appliquer la Migration

```bash
# Appliquer la migration de correction
supabase db push

# Ou si en local
supabase migration up
```

## Test de la Configuration

### Test 1 : Vérifier les tables

```sql
-- Vérifier que toutes les tables existent
SELECT * FROM notification_system_status;
```

Résultat attendu :
```
component                    | status
-----------------------------+--------
push_tokens table            | OK
attendance trigger           | OK
notification preferences     | OK
```

### Test 2 : Vérifier le trigger

```sql
-- Vérifier que le trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_parents_on_absence';
```

### Test 3 : Tester la création d'une notification

```sql
-- Créer un enregistrement de test (remplacez les IDs par des IDs réels)
INSERT INTO attendance_records (
  attendance_session_id,
  school_id,
  student_id,
  status,
  source,
  marked_by
)
VALUES (
  'id-session-existante',
  'id-ecole',
  'id-eleve-avec-parents',
  'absent',  -- ou 'late'
  'teacher_manual',
  'id-professeur'
);

-- Vérifier que la notification a été créée
SELECT * FROM notifications 
WHERE type = 'attendance_marked'
ORDER BY created_at DESC
LIMIT 5;
```

### Test 4 : Vérifier les logs

```sql
-- Voir les logs de notification récents
SELECT 
  nl.*,
  u.first_name,
  u.last_name
FROM notification_logs nl
JOIN users u ON u.id = nl.user_id
WHERE nl.type = 'attendance_marked'
ORDER BY nl.created_at DESC
LIMIT 10;
```

## Configuration Mobile (Expo)

### 1. Enregistrer le Push Token

Dans l'app mobile, enregistrez le token lors de la connexion :

```typescript
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

async function registerForPushNotificationsAsync(userId: string) {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Permission push refusée');
    return;
  }
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Enregistrer dans Supabase
  await supabase.from('push_tokens').upsert({
    user_id: userId,
    token: token,
    platform: 'mobile',
    is_active: true,
    last_used_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,platform'
  });
  
  return token;
}
```

### 2. Gérer la Réception des Notifications

```typescript
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

useEffect(() => {
  // Écouter les notifications reçues
  const subscription = Notifications.addNotificationReceivedListener(
    notification => {
      const { type, studentId, status } = notification.request.content.data;
      
      if (type === 'attendance_marked') {
        // Afficher une alerte ou mettre à jour l'UI
        console.log(`Présence marquée: ${status} pour l'élève ${studentId}`);
      }
    }
  );
  
  return () => subscription.remove();
}, []);
```

## Préférences de Notification

### Modifier les Préférences (SQL)

```sql
-- Mettre à jour les préférences d'un parent
UPDATE notification_preferences
SET preferences = jsonb_set(
  preferences,
  '{attendance_marked}',
  '{
    "in_app": true,
    "push": true,
    "email": true,
    "sms": false
  }'::jsonb
)
WHERE user_id = 'id-du-parent';
```

### Modifier via API

```typescript
const { error } = await supabase
  .from('notification_preferences')
  .upsert({
    user_id: userId,
    preferences: {
      attendance_marked: {
        in_app: true,
        push: true,
        email: false,
        sms: false,
      }
    }
  }, {
    onConflict: 'user_id'
  });
```

## Dépannage

### Problème : Les notifications ne sont pas créées

**Vérifications :**
1. Le trigger existe-t-il ?
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_parents_on_absence';
   ```

2. L'élève a-t-il des parents liés ?
   ```sql
   SELECT * FROM student_parent_relations WHERE student_id = 'id-eleve';
   ```

3. Les parents sont-ils actifs ?
   ```sql
   SELECT * FROM users WHERE id IN (
     SELECT parent_id FROM student_parent_relations WHERE student_id = 'id-eleve'
   ) AND is_active = true;
   ```

### Problème : Les push notifications ne sont pas reçues

**Vérifications :**
1. Le token Expo est-il enregistré ?
   ```sql
   SELECT * FROM push_tokens WHERE user_id = 'id-parent';
   ```

2. La fonction Edge est-elle déployée ?
   ```bash
   supabase functions list
   ```

3. Les logs Edge Function montrent-ils des erreurs ?
   ```bash
   supabase functions logs send-attendance-notification
   ```

### Problème : Les emails ne sont pas envoyés

**Vérifications :**
1. L'email du parent est-il valide ?
   ```sql
   SELECT email FROM users WHERE id = 'id-parent';
   ```

2. La fonction send-email-notification est-elle déployée ?
   ```bash
   supabase functions deploy send-email-notification
   ```

3. Les variables d'environnement sont-elles configurées ?
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`

## Monitoring

### Vue de Synthèse

```sql
-- Nombre de notifications par jour et par type
SELECT 
  DATE(created_at) as date,
  type,
  COUNT(*) as count
FROM notifications
GROUP BY DATE(created_at), type
ORDER BY date DESC, count DESC;
```

### Taux de Succès

```sql
-- Taux de succès par canal
SELECT 
  channel,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'sent')::numeric / COUNT(*) * 100, 
    2
  ) as success_rate
FROM notification_logs
WHERE type = 'attendance_marked'
GROUP BY channel;
```

## Sécurité

### RLS Policies

Les policies suivantes sont configurées :

- **push_tokens** : Les utilisateurs peuvent uniquement gérer leurs propres tokens
- **notifications** : Les utilisateurs peuvent uniquement voir leurs propres notifications
- **notification_logs** : Les utilisateurs peuvent uniquement voir leurs propres logs

### Bonnes Pratiques

1. **Ne jamais exposer** `SUPABASE_SERVICE_ROLE_KEY` côté client
2. **Valider toujours** les données d'entrée dans les Edge Functions
3. **Logger** toutes les erreurs pour faciliter le débogage
4. **Respecter** les préférences de notification des utilisateurs

## Support

Pour toute question ou problème, consultez :
- Les logs : `supabase logs functions send-attendance-notification`
- La documentation Expo : https://docs.expo.dev/push-notifications/overview/
- La documentation Supabase : https://supabase.com/docs/guides/functions
