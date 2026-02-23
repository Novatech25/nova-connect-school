# NovaConnect Gateway LAN

Service local pour fonctionnement offline des opérations critiques (présence, notes, cahier de texte, paiements, EDT).

## 🎯 Objectif

Le Gateway LAN permet aux écoles de continuer à fonctionner même en cas de coupure Internet ou de dégradation du réseau. Il synchronise automatiquement toutes les données avec le cloud lorsque la connexion est rétablie.

## ✨ Fonctionnalités

- **Offline Mode**: Fonctionnement complet sans connexion Internet
- **Synchronisation automatique**: Sync bidirectionnelle toutes les 30 secondes
- **Découverte automatique**: mDNS pour que les clients (web/mobile) découvrent automatiquement le Gateway
- **Licence anti-copie**: Protection liée au matériel (hardware fingerprint)
- **Interface admin**: Monitoring en temps réel via interface web
- **Multi-écoles**: Une base de données séparée par école

## 📋 Prérequis

- [Bun](https://bun.sh/) runtime (performance + compatibilité TypeScript)
- Node.js 18+ (alternative)
- Licence NovaConnect Gateway valide

## 🚀 Installation

### 1. Installer Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Installer les dépendances

```bash
cd apps/gateway
bun install
```

### 3. Configurer les variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
# Port du serveur Gateway
PORT=3001

# Chemin de la base de données SQLite
DATABASE_PATH=./data

# ID de l'école (optionnel si activation via licence)
SCHOOL_ID=

# Configuration Supabase Cloud
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Environnement
NODE_ENV=production
```

### 4. Activer la licence

```bash
bun run activate --license=XXXX-XXXX-XXXX-XXXX --school=school-uuid
```

La licence est **liée au matériel** de la machine et ne peut être activée que sur un seul appareil.

### 5. Démarrer le Gateway

```bash
# Mode développement
bun run dev

# Mode production
bun run start
```

## Docker (LAN)

- `apps/gateway/docker-compose.yml` lance uniquement le Gateway (pas l app web).
- Watchtower/Dozzle sont optionnels et desactives par defaut. Pour les activer: `docker compose --profile monitoring up`.
- Pour Web + Gateway, utiliser le `docker-compose.yml` a la racine du repo.

## 📊 Administration

Interface web disponible : http://localhost:3001/admin

L'interface admin permet de :
- Vérifier le statut de la licence
- Surveiller la synchronisation
- Consulter les événements récents
- Déclencher une synchronisation manuelle
- Nettoyer les anciens événements

## 🔌 API Endpoints

Tous les endpoints nécessitent une authentification via JWT token Supabase.

### Présence (Attendance)

```
POST   /api/attendance/sessions          Créer une session de présence
POST   /api/attendance/records           Marquer la présence
POST   /api/attendance/records/bulk      Marquer plusieurs présences
PATCH  /api/attendance/sessions/:id/submit      Soumettre une session
PATCH  /api/attendance/sessions/:id/validate    Valider une session
GET    /api/attendance/sessions          Lister les sessions
GET    /api/attendance/sessions/:id      Détails d'une session
GET    /api/attendance/sessions/:id/records     Enregistrements d'une session
PATCH  /api/attendance/records/:id       Modifier un enregistrement
```

### Notes (Grades)

```
POST   /api/grades                       Créer une note
POST   /api/grades/bulk                  Créer plusieurs notes
PATCH  /api/grades/:id                   Modifier une note
PATCH  /api/grades/sessions/:sessionId/publish  Publier des notes
GET    /api/grades/student/:studentId    Notes d'un étudiant
GET    /api/grades/class/:classId        Notes d'une classe
GET    /api/grades/:id                   Détails d'une note
DELETE /api/grades/:id                   Supprimer une note
```

### Cahier de texte (Lesson Logs)

```
POST   /api/lesson-logs                  Créer une entrée du cahier de texte
PATCH  /api/lesson-logs/:id              Modifier une entrée
PATCH  /api/lesson-logs/:id/validate     Valider une entrée
GET    /api/lesson-logs/class/:classId   Cahier de texte d'une classe
GET    /api/lesson-logs/teacher/:teacherId   Entrées d'un professeur
GET    /api/lesson-logs/:id              Détails d'une entrée
DELETE /api/lesson-logs/:id              Supprimer une entrée
```

### Paiements (Payments)

```
POST   /api/payments                     Enregistrer un paiement
PATCH  /api/payments/:id                Modifier un paiement
GET    /api/payments/student/:studentId Paiements d'un étudiant
GET    /api/payments                     Liste des paiements (paginé)
GET    /api/payments/:id                Détails d'un paiement
GET    /api/payments/student/:studentId/summary  Résumé des paiements
DELETE /api/payments/:id                Supprimer un paiement
```

### Emploi du temps (Schedule)

```
GET    /api/schedule/class/:classId      EDT d'une classe
GET    /api/schedule/teacher/:teacherId  EDT d'un professeur
GET    /api/schedule/student/:studentId  EDT d'un étudiant
GET    /api/schedule/class/:classId/weekly    EDT hebdomadaire
GET    /api/schedule/:id                Détails d'un créneau
```

### Synchronisation

```
POST   /api/sync/trigger                 Déclencher une sync manuelle
GET    /api/sync/status                  Statut de synchronisation
GET    /api/sync/pending                 Événements en attente
POST   /api/sync/retry                   Réessayer les événements échoués
POST   /api/sync/cleanup                 Nettoyer les anciens événements
```

### Admin

```
GET    /api/admin/license                Informations licence
GET    /api/admin/sync/stats             Statistiques de sync
GET    /api/admin/events                 Événements récents
POST   /api/admin/sync/trigger           Sync manuelle
GET    /api/admin/status                 Statut complet du Gateway
GET    /api/admin/health                 Health check
GET    /api/admin/config                 Configuration
POST   /api/admin/events/cleanup         Nettoyer événements
```

### Santé

```
GET    /health                           Health check (public)
```

## 🔒 Sécurité

### Licence Anti-Copie

Le Gateway utilise un **hardware fingerprint** basé sur :
- Machine ID (unique à chaque machine)
- Adresses MAC des cartes réseau

Si la base de données est copiée sur une autre machine, la licence sera automatiquement révoquée.

### RLS (Row-Level Security)

Chaque requête vérifie automatiquement le `school_id` de l'utilisateur authentifié. Les super-admins doivent explicitement spécifier le `school_id` via query parameter ou header `X-School-Id`.

### Authentification

Tous les endpoints API nécessitent un JWT token Supabase valide dans le header `Authorization: Bearer <token>`.

## 🔄 Synchronisation

### Event Log

Toutes les opérations (create, update, delete) sont enregistrées dans un **event log append-only** :

```sql
CREATE TABLE event_log (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'create', 'update', 'delete'
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT NOT NULL,        -- JSON complet de l'enregistrement
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT,
  sync_status TEXT DEFAULT 'pending',  -- 'pending', 'synced', 'failed'
  sync_error TEXT,
  retry_count INTEGER DEFAULT 0
);
```

### Sync Bidirectionnelle

**Push vers Cloud** :
- Récupère les événements avec `sync_status = 'pending'`
- Envoie à Supabase Cloud via API
- Marque comme `synced` ou `failed`

**Pull depuis Cloud** :
- Récupère les changements depuis `last_sync_timestamp`
- Applique les changements à la base SQLite locale
- Met à jour `last_sync_timestamp`

### Résilience

- **Réessais automatiques** : Jusqu'à 3 tentatives pour chaque événement
- **Mode offline** : Le Gateway continue de fonctionner sans Internet
- **Reprise automatique** : Synchronise dès que la connexion revient

## 🔍 Découverte LAN (mDNS)

Le Gateway s'annonce automatiquement sur le réseau local via mDNS :

- **Service**: `_novaconnect._tcp.local`
- **Port**: 3001 (configurable)
- **TXT Records**:
  - `schoolId`: ID de l'école
  - `version`: Version du Gateway
  - `api`: Chemin de l'API (`/api/v1`)

Les clients (web/mobile) découvrent automatiquement le Gateway et basculent entre :
- **Mode LAN**: Utilisation du Gateway local (offline)
- **Mode Cloud**: Utilisation directe de Supabase (online)

## 🧪 Tests

```bash
bun test
```

## 📝 Scripts Disponibles

```bash
bun run dev          # Mode développement avec hot reload
bun run build        # Compiler le projet
bun run start        # Démarrer le serveur
bun run migrate      # Exécuter les migrations
bun run activate     # Activer une licence
```

## 🛠️ Dépannage

### Licence invalide

```bash
# Vérifier le hardware fingerprint
node -e "console.log(require('node-machine-id').machineIdSync())"

# Réactiver la licence si nécessaire
bun run activate --license=XXXX --school=YYYY
```

### Base de données corrompue

```bash
# Sauvegarder la base de données actuelle
cp data/<school-id>.db data/<school-id>.db.backup

# Supprimer et réactiver la licence
rm data/<school-id>.db
bun run activate --license=XXXX --school=YYYY
```

### Synchronisation bloquée

```bash
# Réessayer les événements échoués
curl -X POST http://localhost:3001/api/sync/retry

# Nettoyer les anciens événements
curl -X POST http://localhost:3001/api/sync/cleanup
```

## 📦 Structure du Projet

```
apps/gateway/
├── src/
│   ├── server.ts              # Point d'entrée Bun
│   ├── config/
│   │   ├── database.ts        # Configuration SQLite
│   │   ├── license.ts         # Configuration licence
│   │   └── mdns.ts            # Configuration mDNS
│   ├── db/
│   │   ├── schema.sql         # Schéma SQLite miroir
│   │   └── client.ts          # Client SQLite singleton
│   ├── routes/
│   │   ├── attendance.ts      # Endpoints présence
│   │   ├── grades.ts          # Endpoints notes
│   │   ├── lesson-logs.ts     # Endpoints cahier de texte
│   │   ├── payments.ts        # Endpoints paiements
│   │   ├── schedule.ts        # Endpoints EDT
│   │   ├── sync.ts            # Endpoints synchronisation
│   │   └── admin.ts           # Endpoints admin
│   ├── services/
│   │   ├── license.ts         # Validation licence
│   │   ├── mdns.ts            # Service mDNS
│   │   ├── event-log.ts       # Event log append-only
│   │   └── sync-engine.ts     # Moteur de synchronisation
│   ├── middleware/
│   │   ├── auth.ts            # Authentification locale
│   │   ├── rls.ts             # RLS local (school_id)
│   │   └── license.ts         # Vérification licence
│   └── admin-ui/
│       └── index.html         # Interface admin web
├── scripts/
│   └── activate.ts            # Script d'activation licence
├── package.json
├── tsconfig.json
└── README.md
```

## 🤝 Intégration avec les apps existantes

Côté client (web/mobile), utiliser le `GatewayClient` :

```typescript
import { GatewayClient } from '@novaconnect/data';

const client = new GatewayClient({
  schoolId: 'school-uuid',
  supabaseUrl: 'https://...',
  supabaseAnonKey: '...'
});

await client.init();

// Créer une session de présence (offline si nécessaire)
await client.createAttendanceSession({
  plannedSessionId: '...',
  teacherId: '...',
  classId: '...',
  sessionDate: '2024-01-15'
});
```

Le client bascule automatiquement entre :
- Gateway LAN (priorité)
- Supabase Cloud (fallback)

## 📄 Licence

Ce projet fait partie du projet NovaConnect et est soumis à la même licence.

## 🆘 Support

Pour toute question ou problème :
1. Consulter l'interface admin : http://localhost:3001/admin
2. Vérifier les logs du Gateway
3. Consulter la documentation Supabase : https://supabase.com/docs
