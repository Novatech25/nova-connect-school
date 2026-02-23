# Documentation Webhooks

## Vue d'ensemble

Les webhooks NovaConnect permettent à votre application de recevoir des notifications en temps réel lorsque des événements se produisent dans le système. Au lieu d'interroger régulièrement pour détecter les modifications, vous pouvez configurer des webhooks pour que NovaConnect envoie les données à votre point de terminaison.

## Événements Webhook

### Événements Étudiant

#### `student.created`
Déclenché lorsqu'un nouvel étudiant est inscrit.

**Charge utile :**
```json
{
  "event": "student.created",
  "timestamp": "2024-10-15T10:30:00Z",
  "schoolId": "school_abc",
  "data": {
    "studentId": "student_123",
    "matricule": "2024-001",
    "firstName": "John",
    "lastName": "Doe",
    "grade": "Grade 10",
    "class": "10A"
  }
}
```

#### `student.updated`
Déclenché lorsque les informations de l'étudiant sont modifiées.

#### `student.deleted`
Déclenché lorsqu'un enregistrement d'étudiant est supprimé ou que l'étudiant se retire.

### Événements Note

#### `grade.published`
Déclenché lorsque les notes sont publiées et visibles par les étudiants/parents.

**Charge utile :**
```json
{
  "event": "grade.published",
  "timestamp": "2024-10-15T10:30:00Z",
  "schoolId": "school_abc",
  "data": {
    "gradeIds": ["grade_123", "grade_456"],
    "classId": "class_789",
    "term": "Term 1",
    "academicYear": "2024-2025",
    "publishedBy": "teacher_123",
    "studentCount": 30
  }
}
```

#### `grade.created`
Déclenché lorsqu'une nouvelle note est créée (brouillon).

### Événements Présence

#### `attendance.recorded`
Déclenché lorsque la présence est soumise pour une classe.

**Charge utile :**
```json
{
  "event": "attendance.recorded",
  "timestamp": "2024-10-15T10:30:00Z",
  "schoolId": "school_abc",
  "data": {
    "sessionId": "session_123",
    "date": "2024-10-15",
    "classId": "class_789",
    "recordedBy": "teacher_123",
    "statistics": {
      "total": 30,
      "present": 28,
      "absent": 1,
      "late": 1
    }
  }
}
```

### Événements Paiement

#### `payment.received`
Déclenché lorsqu'un paiement est enregistré avec succès.

**Charge utile :**
```json
{
  "event": "payment.received",
  "timestamp": "2024-10-15T10:30:00Z",
  "schoolId": "school_abc",
  "data": {
    "paymentId": "payment_123",
    "studentId": "student_456",
    "amount": 500000,
    "paymentMethod": "bank_transfer",
    "transactionRef": "TXN-12345",
    "recordedBy": "user_789"
  }
}
```

#### `payment.overdue`
Déclenché lorsqu'un paiement devient en retard (vérification quotidienne).

#### `payment.reminder_sent`
Déclenché lorsqu'un rappel de paiement est envoyé au parent/tuteur.

### Événements Utilisateur

#### `user.created`
Déclenché lorsqu'un nouveau compte utilisateur est créé.

#### `user.login`
Déclenché lorsqu'un utilisateur se connecte (peut être utilisé pour la détection d'activités suspectes).

#### `user.password_changed`
Déclenché lorsqu'un utilisateur modifie son mot de passe.

### Événements Système

#### `system.maintenance_scheduled`
Envoyé 24 heures avant la maintenance programmée.

#### `system.backup_completed`
Déclenché après la sauvegarde réussie du système.

## Configuration des Webhooks

### Via le tableau de bord

1. Accédez à **Paramètres > Intégrations > Webhooks**
2. Cliquez sur **Ajouter un Webhook**
3. Configurez :
   - **URL du point de terminaison** : Votre URL serveur pour recevoir les événements
   - **Événements** : Sélectionnez les événements auxquels vous abonner
   - **Secret** : Générez un secret pour la vérification de signature
   - **Actif** : Activer/désactiver le webhook
4. Enregistrez la configuration

### Via l'API

```bash
curl -X POST https://api.novaconnect.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhooks",
    "events": ["student.created", "grade.published", "payment.received"],
    "secret": "your-webhook-secret"
  }'
```

**Réponse :**
```json
{
  "data": {
    "id": "webhook_123",
    "url": "https://your-server.com/webhooks",
    "events": ["student.created", "grade.published", "payment.received"],
    "active": true,
    "createdAt": "2024-10-15T10:30:00Z"
  }
}
```

## Signature Webhook

NovaConnect signe les événements webhook pour vérifier l'authenticité. Chaque requête webhook comprend :

### En-têtes

```
X-Webhook-Signature: sha256=SIGNATURE
X-Webhook-Timestamp: 1697388600
X-Webhook-Event: student.created
X-Webhook-ID: wh_abc123
```

### Vérification des signatures

```javascript
import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  const expectedSignature = `sha256=${digest}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Exemple d'utilisation
const express = require('express');
const app = express();

app.post('/webhooks', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;

  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payload);
  // Traiter l'événement
  console.log('Received event:', event.event);

  res.status(200).send('OK');
});
```

Exemple Python :
```python
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

WEBHOOK_SECRET = 'your-webhook-secret'

@app.route('/webhooks', methods=['POST'])
def handle_webhook():
    payload = request.data
    signature = request.headers.get('X-Webhook-Signature')

    # Vérifier la signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    expected_signature = f'sha256={expected_signature}'

    if not hmac.compare_digest(signature, expected_signature):
        return 'Invalid signature', 401

    event = request.json
    # Traiter l'événement
    print(f"Received event: {event['event']}")

    return 'OK', 200
```

## Gestion des Webhooks

### Bonnes pratiques

1. **Renvoyer 200 OK rapidement**
   - Accusez réception du webhook immédiatement
   - Traitez l'événement de manière asynchrone
   - N'effectuez pas de tâches longues dans le gestionnaire de webhook

2. **Idempotence**
   - Les événements webhook peuvent être livrés plusieurs fois
   - Utilisez l'en-tête `X-Webhook-ID` pour dédupliquer les événements
   - Rendez les opérations idempotentes lorsque cela est possible

3. **Gestion des erreurs**
   - Renvoyez toujours 200 OK même si le traitement échoue
   - Journalisez les erreurs pour investigation
   - Implémentez une logique de nouvelle tentative dans votre file de traitement

4. **Sécurité**
   - Vérifiez toujours les signatures webhook
   - Utilisez des points de terminaison HTTPS
   - Gardez les secrets webhook sécurisés
   - Journalisez toutes les livraisons webhook

### Exemple d'implémentation

```javascript
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(/* ... */);

// Stocker les ID webhook traités
const processedWebhooks = new Set();

app.post('/webhooks', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    // Vérifier la signature
    const signature = req.headers['x-webhook-signature'];
    const webhookId = req.headers['x-webhook-id'];

    if (!verifyWebhookSignature(req.body, signature, WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      return res.status(401).send('Invalid signature');
    }

    // Vérifier les doublons
    if (processedWebhooks.has(webhookId)) {
      console.log('Duplicate webhook, ignoring');
      return res.status(200).send('Already processed');
    }

    const event = JSON.parse(req.body);

    // Traiter en fonction du type d'événement
    switch (event.event) {
      case 'student.created':
        await handleStudentCreated(event.data);
        break;
      case 'grade.published':
        await handleGradePublished(event.data);
        break;
      case 'payment.received':
        await handlePaymentReceived(event.data);
        break;
      default:
        console.log('Unhandled event type:', event.event);
    }

    // Marquer comme traité
    processedWebhooks.add(webhookId);

    // Nettoyer les anciens ID (conserver les 10 000 derniers)
    if (processedWebhooks.size > 10000) {
      const oldest = Array.from(processedWebhooks)[0];
      processedWebhooks.delete(oldest);
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('Error processing webhook:', error);
    // Renvoyer quand même 200 pour éviter les nouvelles tentatives
    res.status(200).send('Error logged');
  }
});

async function handleStudentCreated(data) {
  // Synchroniser l'étudiant avec le système externe
  await externalSystem.createStudent(data);
  // Envoyer un email de bienvenue
  await emailService.sendWelcomeEmail(data);
  // Mettre à jour le cache local
  await cache.invalidate(`student:${data.studentId}`);
}

async function handleGradePublished(data) {
  // Notifier les parents par SMS
  for (const gradeId of data.gradeIds) {
    await notificationService.notifyGradePublished(gradeId);
  }
  // Mettre à jour les analyses
  await analytics.track('grades_published', data);
}
```

## Politique de nouvelle tentative

Si votre point de terminaison renvoie un statut non-2xx ou expire, NovaConnect réessayera la livraison :

| Tentative | Timing |
|-----------|--------|
| 1 | Immédiat |
| 2 | 1 minute plus tard |
| 3 | 5 minutes plus tard |
| 4 | 30 minutes plus tard |
| 5 | 2 heures plus tard |
| 6 | 6 heures plus tard |
| 7 | 24 heures plus tard |

Après 7 tentatives échouées, le webhook est désactivé et vous recevrez une notification par email.

## Tests des Webhooks

### Utilisation d'un tunnel local

Testez les webhooks localement en utilisant des outils comme ngrok ou localtunnel :

```bash
# Utilisation de ngrok
ngrok http 3000

# Votre URL webhook serait :
# https://abc123.ngrok.io/webhooks
```

### Événements de test

Envoyez des événements de test depuis le tableau de bord :
1. Accédez à **Paramètres > Intégrations > Webhooks**
2. Sélectionnez le webhook
3. Cliquez sur **Envoyer un événement de test**
4. Choisissez le type d'événement à envoyer
5. Affichez le statut de livraison

### Journaux Webhook

Affichez toutes les livraisons webhook :
1. Accédez à **Paramètres > Intégrations > Webhooks > Journaux**
2. Filtrez par :
   - Webhook
   - Type d'événement
   - Statut (succès/échec)
   - Plage de dates
3. Affichez :
   - Charge utile de la requête
   - Statut de la réponse
   - Tentatives de nouvelle tentative
   - Messages d'erreur

## Gestion des Webhooks

### Lister les Webhooks

```bash
curl https://api.novaconnect.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Obtenir les détails d'un Webhook

```bash
curl https://api.novaconnect.com/v1/webhooks/{webhook_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Mettre à jour un Webhook

```bash
curl -X PATCH https://api.novaconnect.com/v1/webhooks/{webhook_id} \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "active": false
  }'
```

### Supprimer un Webhook

```bash
curl -X DELETE https://api.novaconnect.com/v1/webhooks/{webhook_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Faire pivoter le Secret

```bash
curl -X POST https://api.novaconnect.com/v1/webhooks/{webhook_id}/rotate-secret \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Réponse :**
```json
{
  "data": {
    "id": "webhook_123",
    "secret": "new-webhook-secret"
  }
}
```

## Référence des Événements

Tous les événements incluent :

```typescript
{
  event: string;          // Nom de l'événement
  timestamp: string;      // Horodatage ISO 8601
  schoolId: string;       // ID de l'école
  data: any;             // Données spécifiques à l'événement
}
```

### Liste complète des événements

| Événement | Description | Champs de données |
|-----------|-------------|-------------------|
| `student.created` | Nouvel étudiant inscrit | studentId, matricule, firstName, lastName, grade |
| `student.updated` | Informations étudiant modifiées | studentId, changedFields |
| `student.deleted` | Étudiant supprimé | studentId |
| `grade.published` | Notes publiées | gradeIds, classId, term |
| `grade.created` | Note brouillon créée | gradeId, studentId, subject |
| `attendance.recorded` | Présence soumise | sessionId, date, statistics |
| `payment.received` | Paiement enregistré | paymentId, amount, studentId |
| `payment.overdue` | Paiement en retard | studentId, amount, daysOverdue |
| `payment.reminder_sent` | Rappel envoyé | studentId, reminderType |
| `user.created` | Compte utilisateur créé | userId, email, role |
| `user.login` | Utilisateur connecté | userId, timestamp, ip |
| `user.password_changed` | Mot de passe modifié | userId |
| `system.maintenance_scheduled` | Maintenance programmée | startTime, duration |
| `system.backup_completed` | Sauvegarde terminée | timestamp, size |

## Dépannage

### Webhook non reçu

**Causes possibles :**
1. Le point de terminaison webhook est hors service ou inaccessible
2. Le serveur a renvoyé un statut non-200
3. La vérification de signature échoue
4. Problèmes de connectivité réseau
5. Le webhook est désactivé

**Solutions :**
1. Vérifiez les journaux webhook dans le tableau de bord
2. Vérifiez que le point de terminaison est accessible
3. Testez la vérification de signature
4. Vérifiez les journaux du serveur
5. Réactivez le webhook s'il est désactivé

### Événements en double

**Cause** : Comportement normal pour les nouvelles tentatives ou l'idempotence

**Solution** : Dédupliquez en utilisant l'en-tête `X-Webhook-ID`

### Échec de la vérification de signature

**Causes possibles :**
1. Secret incorrect
2. Problèmes d'encodage de la charge utile
3. Horodatage expiré (plus de 5 minutes)

**Solutions :**
1. Vérifiez que le secret correspond au tableau de bord
2. Assurez-vous d'utiliser la charge utile brute (non analysée)
3. Vérifiez que l'horloge système est synchronisée

### Délais d'expiration

**Délai d'expiration par défaut** : 10 secondes

**Solution** : Traitez les événements de manière asynchrone, renvoyez 200 OK immédiatement

## Résumé des bonnes pratiques

1. **Sécurité**
   - Vérifiez toujours les signatures
   - Utilisez des points de terminaison HTTPS
   - Gardez les secrets sécurisés
   - Journalisez toutes les livraisons

2. **Fiabilité**
   - Traitez de manière asynchrone
   - Implémentez l'idempotence
   - Gérez les doublons
   - Surveillez le statut de livraison

3. **Performance**
   - Renvoyez 200 OK rapidement
   - Utilisez des files de tâches pour le traitement
   - Implémentez une logique de nouvelle tentative dans votre application
   - Ne bloquez pas le gestionnaire de webhook

4. **Surveillance**
   - Journalisez tous les événements webhook
   - Suivez les échecs de traitement
   - Configurez des alertes pour les échecs répétés
   - Surveillez les journaux webhook dans le tableau de bord

## Ressources

- **Tableau de bord Webhooks** : [novaconnect.com/dashboard/webhooks](https://novaconnect.com/dashboard/webhooks)
- **Référence API** : [Documentation de l'API REST](./rest-api.md)
- **Support** : webhooks-support@novaconnect.com
