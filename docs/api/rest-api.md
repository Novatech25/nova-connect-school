# Documentation de l'API REST

## Vue d'ensemble

NovaConnect fournit une API REST complète pour l'accès programmatique aux fonctionnalités de gestion scolaire. L'API respecte les conventions RESTful et renvoie des réponses JSON.

## URL de base

| Environnement | URL de base |
|---------------|-------------|
| Développement | `https://dev-api.novaconnect.com` |
| Préproduction | `https://staging-api.novaconnect.com` |
| Production | `https://api.novaconnect.com` |

## Authentification

Toutes les requêtes API nécessitent une authentification à l'aide d'un jeton Bearer.

### Obtenir des jetons d'accès

#### Pour les applications côté serveur
Utilisez la clé `service_role` (n'exposez jamais ce jeton aux clients) :

```bash
curl -X POST https://api.novaconnect.com/auth/v1/token?grant_type=client_credentials \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

#### Pour les applications côté client
Utilisez l'authentification utilisateur via Supabase Auth :

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});

const token = data.session.access_token;
```

### Effectuer des requêtes authentifiées

```bash
curl https://api.novaconnect.com/v1/students \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

## Format de réponse API

Toutes les réponses API suivent cette structure :

### Réponse réussie
```json
{
  "data": { /* Données de réponse */ },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Réponse d'erreur
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## Codes d'erreur courants

| Code | Statut HTTP | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Jeton d'authentification invalide ou manquant |
| `FORBIDDEN` | 403 | Permissions insuffisantes |
| `NOT_FOUND` | 404 | Ressource non trouvée |
| `VALIDATION_ERROR` | 400 | Données de requête invalides |
| `CONFLICT` | 409 | La ressource existe déjà ou conflit |
| `RATE_LIMIT_EXCEEDED` | 429 | Trop de requêtes |
| `INTERNAL_ERROR` | 500 | Erreur serveur |

## Points de terminaison API

### Étudiants

#### Lister les étudiants

```http
GET /v1/students
```

**Paramètres de requête :**
- `school_id` (chaîne, obligatoire) : ID de l'école
- `grade_id` (chaîne, facultatif) : Filtrer par niveau
- `class_id` (chaîne, facultatif) : Filtrer par classe
- `status` (chaîne, facultatif) : `active` | `inactive` | `graduated`
- `search` (chaîne, facultatif) : Rechercher par nom ou matricule
- `page` (entier, facultatif) : Numéro de page (par défaut : 1)
- `limit` (entier, facultatif) : Éléments par page (par défaut : 20, max : 100)

**Réponse :**
```json
{
  "data": [
    {
      "id": "student_123",
      "matricule": "2024-001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@school.com",
      "gradeId": "grade_123",
      "classId": "class_456",
      "status": "active",
      "enrollmentDate": "2024-09-01",
      "photoUrl": "https://cdn.novaconnect.com/photos/student_123.jpg"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

#### Obtenir les détails d'un étudiant

```http
GET /v1/students/{student_id}
```

**Réponse :**
```json
{
  "data": {
    "id": "student_123",
    "matricule": "2024-001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@school.com",
    "phone": "+1234567890",
    "dateOfBirth": "2010-05-15",
    "gender": "male",
    "address": {
      "street": "123 Main St",
      "city": "City",
      "country": "Country"
    },
    "guardians": [
      {
        "id": "parent_123",
        "firstName": "Jane",
        "lastName": "Doe",
        "relationship": "mother",
        "phone": "+1234567890",
        "email": "jane.doe@email.com"
      }
    ],
    "grade": {
      "id": "grade_123",
      "name": "Grade 10"
    },
    "class": {
      "id": "class_456",
      "name": "10A"
    }
  }
}
```

#### Créer un étudiant

```http
POST /v1/students
```

**Corps de la requête :**
```json
{
  "matricule": "2024-001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@school.com",
  "phone": "+1234567890",
  "dateOfBirth": "2010-05-15",
  "gender": "male",
  "gradeId": "grade_123",
  "classId": "class_456",
  "schoolId": "school_abc",
  "guardians": [
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "relationship": "mother",
      "phone": "+1234567890",
      "email": "jane.doe@email.com"
    }
  ]
}
```

**Réponse :** `201 Created` avec l'objet étudiant créé

#### Mettre à jour un étudiant

```http
PATCH /v1/students/{student_id}
```

**Corps de la requête :** Objet étudiant partiel avec les champs à mettre à jour

#### Supprimer un étudiant

```http
DELETE /v1/students/{student_id}
```

**Réponse :** `204 No Content`

### Notes

#### Lister les notes

```http
GET /v1/grades
```

**Paramètres de requête :**
- `school_id` (chaîne, obligatoire) : ID de l'école
- `student_id` (chaîne, facultatif) : Filtrer par étudiant
- `class_id` (chaîne, facultatif) : Filtrer par classe
- `subject_id` (chaîne, facultatif) : Filtrer par matière
- `term` (chaîne, facultatif) : Filtrer par trimestre
- `status` (chaîne, facultatif) : `draft` | `published`

**Réponse :**
```json
{
  "data": [
    {
      "id": "grade_123",
      "studentId": "student_123",
      "subjectId": "subject_456",
      "classId": "class_789",
      "term": "Term 1",
      "academicYear": "2024-2025",
      "score": 85.5,
      "maxScore": 100,
      "grade": "A",
      "status": "published",
      "gradedBy": "teacher_123",
      "gradedAt": "2024-10-15T10:30:00Z",
      "publishedAt": "2024-10-16T09:00:00Z"
    }
  ]
}
```

#### Créer une note

```http
POST /v1/grades
```

**Corps de la requête :**
```json
{
  "studentId": "student_123",
  "subjectId": "subject_456",
  "classId": "class_789",
  "term": "Term 1",
  "academicYear": "2024-2025",
  "score": 85.5,
  "maxScore": 100,
  "assessmentType": "exam",
  "comments": "Excellent performance"
}
```

#### Publier les notes

```http
POST /v1/grades/publish
```

**Corps de la requête :**
```json
{
  "gradeIds": ["grade_123", "grade_456"],
  "notifyStudents": true,
  "notifyParents": true
}
```

### Présences

#### Enregistrer les présences

```http
POST /v1/attendance
```

**Corps de la requête :**
```json
{
  "sessionId": "session_123",
  "date": "2024-10-15",
  "records": [
    {
      "studentId": "student_123",
      "status": "present",
      "remarks": null
    },
    {
      "studentId": "student_456",
      "status": "absent",
      "remarks": "Sick leave submitted"
    }
  ]
}
```

#### Obtenir les enregistrements de présence

```http
GET /v1/attendance
```

**Paramètres de requête :**
- `student_id` (chaîne, facultatif) : Filtrer par étudiant
- `class_id` (chaîne, facultatif) : Filtrer par classe
- `from_date` (date, obligatoire) : Date de début
- `to_date` (date, obligatoire) : Date de fin

### Paiements

#### Lister les paiements

```http
GET /v1/payments
```

**Paramètres de requête :**
- `school_id` (chaîne, obligatoire) : ID de l'école
- `student_id` (chaîne, facultatif) : Filtrer par étudiant
- `from_date` (date, facultatif) : Date de début
- `to_date` (date, facultatif) : Date de fin
- `status` (chaîne, facultatif) : `pending` | `completed` | `failed`

#### Enregistrer un paiement

```http
POST /v1/payments
```

**Corps de la requête :**
```json
{
  "studentId": "student_123",
  "amount": 500000,
  "paymentMethod": "bank_transfer",
  "feeScheduleId": "fee_456",
  "reference": "TXN-12345",
  "receivedBy": "user_789",
  "schoolId": "school_abc"
}
```

#### Obtenir le solde d'un étudiant

```http
GET /v1/payments/students/{student_id}/balance
```

**Réponse :**
```json
{
  "data": {
    "studentId": "student_123",
    "academicYear": "2024-2025",
    "totalFees": 2000000,
    "totalPaid": 1500000,
    "remainingBalance": 500000,
    "overdueAmount": 200000,
    "lastPaymentDate": "2024-10-01"
  }
}
```

### Classes

#### Lister les classes

```http
GET /v1/classes
```

**Paramètres de requête :**
- `school_id` (chaîne, obligatoire) : ID de l'école
- `grade_id` (chaîne, facultatif) : Filtrer par niveau
- `teacher_id` (chaîne, facultatif) : Filtrer par professeur assigné

#### Créer une classe

```http
POST /v1/classes
```

**Corps de la requête :**
```json
{
  "name": "10A",
  "gradeId": "grade_123",
  "schoolId": "school_abc",
  "room": "Room 101",
  "capacity": 30,
  "classTeacherId": "teacher_456"
}
```

## Limitation de débit

Les requêtes API sont limitées en débit pour assurer une utilisation équitable :

| Forfait | Requêtes par heure | Requêtes par jour |
|---------|-------------------|-------------------|
| Gratuit | 100 | 1 000 |
| Basic | 1 000 | 10 000 |
| Pro | 10 000 | 100 000 |
| Entreprise | Illimité | Illimité |

Les en-têtes de limitation de débit sont inclus dans les réponses :
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1634312400
```

## Pagination

Les points de terminaison de liste prennent en charge la pagination :

**Requête :**
```http
GET /v1/students?page=2&limit=20
```

**Réponse :**
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 2,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrevious": true
  }
}
```

## Filtrage et tri

### Filtrage
Utilisez les paramètres de requête pour filtrer les résultats :

```http
GET /v1/students?status=active&grade_id=grade_123
```

### Tri
Utilisez les paramètres `sort` et `order` :

```http
GET /v1/students?sort=lastName&order=asc
```

### Recherche
Utilisez le paramètre `q` pour la recherche plein texte :

```http
GET /v1/students?q=John+Doe
```

## Webhooks

NovaConnect prend en charge les webhooks pour les notifications en temps réel. Consultez la [Documentation Webhooks](./webhooks.md) pour plus de détails.

## SDK et bibliothèques

SDK officiels :

- **JavaScript/TypeScript** : `@novaconnect/sdk`
- **Python** : `novaconnect-python`
- **PHP** : `novaconnect-php`

Exemple (JavaScript) :
```javascript
import { NovaConnect } from '@novaconnect/sdk';

const client = new NovaConnect({
  apiKey: 'your-api-key',
  apiUrl: 'https://api.novaconnect.com'
});

const students = await client.students.list({
  schoolId: 'school_abc',
  status: 'active'
});
```

## Tests

### environnement de bac à sable

Utilisez l'environnement de bac à sable pour les tests :

```bash
curl https://sandbox-api.novaconnect.com/v1/students \
  -H "Authorization: Bearer SANDBOX_API_KEY"
```

Fonctionnalités de la bac à sable :
- Données de test isolées
- Aucun impact sur la production
- Tests sans limite de débit
- Traitement des paiements simulé

## Bonnes pratiques

1. **Authentification** : N'exposez jamais les clés API dans le code côté client
2. **Gestion des erreurs** : Gérez toujours les erreurs API avec élégance
3. **Limites de débit** : Implémentez une temporisation exponentielle pour les nouvelles tentatives
4. **Pagination** : Utilisez la pagination pour les grands ensembles de résultats
5. **Mise en cache** : Mettez en cache les données fréquemment consultées
6. **Webhooks** : Utilisez les webhooks au lieu du polling pour les mises à jour en temps réel

## Support

- **Documentation API** : https://docs.novaconnect.com/api
- **Page de statut** : https://status.novaconnect.com
- **Email de support** : api-support@novaconnect.com
- **Forum communautaire** : https://community.novaconnect.com
