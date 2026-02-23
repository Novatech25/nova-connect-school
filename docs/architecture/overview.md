# Architecture Globale NovaConnect

## Vue d'Ensemble

NovaConnect est une plateforme de gestion scolaire multi-tenant bâtie sur une architecture monorepo avec Turborepo.

```
┌─────────────────────────────────────────────────────────────┐
│                        NovaConnect                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  Web App     │      │  Mobile App  │                   │
│  │  (Next.js)   │      │  (Expo)      │                   │
│  └──────┬───────┘      └──────┬───────┘                   │
│         │                     │                            │
│         └──────────┬──────────┘                            │
│                    │                                       │
│         ┌──────────▼──────────┐                            │
│         │   Supabase Cloud    │                            │
│         │   - Database        │                            │
│         │   - Auth            │                            │
│         │   - Storage         │                            │
│         │   - Edge Functions  │                            │
│         └──────────┬──────────┘                            │
│                    │                                       │
│         ┌──────────▼──────────┐                            │
│         │  Gateway LAN        │                            │
│         │  (Bun Runtime)      │                            │
│         └─────────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## Composants Principaux

### 1. Applications Frontend

#### Web App (`apps/web`)
- **Framework**: Next.js 14 avec App Router
- **UI**: React + TailwindCSS + shadcn/ui
- **Auth**: Supabase Auth (JWT)
- **State**: React Context + Zustand
- **Routing**: App Router avec routes protégées par rôle

#### Mobile App (`apps/mobile`)
- **Framework**: Expo + React Native
- **Navigation**: Expo Router (file-based routing)
- **UI**: React Native Paper + Custom Components
- **Offline**: AsyncStorage + IndexedDB
- **PWA**: Support pour installation offline

### 2. Packages Partagés

#### Core (`packages/core`)
- Utilitaires métier (calculs paie, moyennes, etc.)
- Helpers géolocalisation
- Logique de présence
- Génération cartes scolaires

#### Data (`packages/data`)
- Requêtes Supabase typées
- Mutations avec RLS
- Cache client

#### Sync (`packages/sync`)
- Queue offline
- Sync engine (push/pull)
- Résolution de conflits
- Détection Gateway LAN

#### UI (`packages/ui`)
- Composants partagés web/mobile
- Thème personnalisé
- Design system

### 3. Backend

#### Supabase Cloud
- **Database**: PostgreSQL 15
- **Auth**: JWT avec refresh tokens
- **Storage**: S3-compatible pour documents
- **Realtime**: WebSockets pour notifications
- **Edge Functions**: Deno runtime

#### Gateway LAN
- **Runtime**: Bun (performant)
- **API**: REST + WebSocket
- **Sync**: Bidirectionnelle avec Cloud
- **License**: Anti-copie avec hardware fingerprint

## Flux de Données

### Authentification Multi-Rôle

```
┌─────────┐
│  User   │
└────┬────┘
     │ email/password
     ▼
┌─────────────────┐
│ Supabase Auth   │
│ - Validate      │
│ - Generate JWT  │
└────┬────────────┘
     │ access_token + refresh_token
     ▼
┌─────────────────┐
│   Web/Mobile    │
│ - Store tokens  │
│ - Fetch profile │
└────┬────────────┘
     │ user_id + role
     ▼
┌─────────────────┐
│  Route Guards   │
│ - Check role    │
│ - Redirect      │
└─────────────────┘
```

### Présence Prof + QR → Fusion

```
┌──────────┐        ┌──────────┐
│  Prof    │        │  Élève   │
│          │        │          │
│ Marque   │        │ Scan QR  │
│ Présence │        │ Présence │
└────┬─────┘        └────┬─────┘
     │                   │
     │                   │
     ▼                   ▼
┌──────────────────────────────┐
│      Supabase Cloud          │
│                              │
│  attendance_records          │
│  - teacher_marked            │
│  - qr_scanned                │
└──────┬───────────────────────┘
       │
       │ merge_strategy
       ▼
┌──────────────────────────────┐
│    Fusion Logic              │
│    - teacher_wins            │
│    - qr_wins                 │
│    - coexist                 │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Final Attendance Status     │
│  - present                   │
│  - absent                    │
│  - late                      │
└──────────────────────────────┘
```

### Notes: Saisie → Validation → Publication → Notification

```
┌──────────┐
│  Prof    │
│          │
│ Saisie   │
│ Notes    │
└────┬─────┘
     │
     ▼
┌──────────────────────────────┐
│      Draft Grades            │
│  - score                     │
│  - coefficient               │
│  - status: draft             │
└──────┬───────────────────────┘
       │
       │ Soumettre
       ▼
┌──────────────────────────────┐
│    Submitted Grades          │
│  - status: submitted         │
│  - awaiting_approval         │
└──────┬───────────────────────┘
       │
       │ Valider (Admin)
       ▼
┌──────────────────────────────┐
│    Approved Grades           │
│  - status: approved          │
│  - validated_by: admin       │
└──────┬───────────────────────┘
       │
       │ Publier
       ▼
┌──────────────────────────────┐
│    Published Grades          │
│  - status: published         │
│  - published_at              │
└──────┬───────────────────────┘
       │
       │ Trigger Notification
       ▼
┌──────────────────────────────┐
│    Send Notification         │
│  - to: students, parents     │
│  - channels: push, email     │
└──────────────────────────────┘
```

### Paiement → Blocage Documents → Override Admin

```
┌──────────┐
│ Admin    │
│          │
│ Crée     │
│ Échéancier│
└────┬─────┘
     │
     ▼
┌──────────────────────────────┐
│   Payment Schedule           │
│  - installment_1: 100000     │
│  - installment_2: 100000     │
│  - installment_3: 100000     │
└──────┬───────────────────────┘
       │
       │ Check solde
       ▼
┌──────────────────────────────┐
│   Arriérés détectés?         │
│  - unpaid_installments > 0   │
└──────┬───────────────────────┘
       │
       │ OUI
       ▼
┌──────────────────────────────┐
│   Blocage Documents          │
│  - bulletin: BLOCKED         │
│  - certificat: BLOCKED       │
└──────┬───────────────────────┘
       │
       │ Override Admin
       ▼
┌──────────────────────────────┐
│   Override avec              │
│  - justification             │
│  - audit_log                 │
└──────────────────────────────┘
```

### Sync Offline: Queue → Push Cloud → Pull Cloud → Conflict Resolution

```
┌──────────────────┐
│   Offline Mode   │
│                  │
│  User action     │
│  - Marque abs    │
│  - Saisit note   │
└──────┬───────────┘
       │
       ▼
┌──────────────────────────────┐
│    Offline Queue             │
│  - [{                       │
│      id: op-1,               │
│      action: create,         │
│      resource: attendance,   │
│      data: {...},            │
│      synced: false           │
│    }]                        │
└──────┬───────────────────────┘
       │
       │ Online
       ▼
┌──────────────────────────────┐
│    Sync Engine               │
│  - push()                    │
│  - pull()                    │
│  - bidirectional()           │
└──────┬───────────────────────┘
       │
       │ Push pending
       ▼
┌──────────────────────────────┐
│   Cloud Supabase             │
│  - POST /api/sync/push       │
│  - Insert/Update records     │
└──────┬───────────────────────┘
       │
       │ Pull changes
       ▼
┌──────────────────────────────┐
│   GET /api/sync/pull         │
│  - since: timestamp          │
│  - resources: [...]          │
└──────┬───────────────────────┘
       │
       │ Conflict detected?
       ▼
┌──────────────────────────────┐
│   Conflict Resolution        │
│  - Payments: append-only     │
│  - Grades: versioning        │
│  - Schedules: LWW/manual     │
│  - Attendance: merge         │
└──────────────────────────────┘
```

## Stratégie Multi-Tenant

### Isolation par École (RLS)

```sql
-- Exemple Policy RLS
CREATE POLICY "schools_isolation" ON schools
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE school_id = schools.id
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );
```

### Rôles et Permissions

| Role | Scope | Permissions |
|------|-------|-------------|
| `super_admin` | Global | CRUD toutes écoles, gestion licences, monitoring |
| `school_admin` | École | CRUD école, utilisateurs, validation, paiements |
| `teacher` | Classes assignées | Marquer présence, saisir notes, cahier texte |
| `student` | Données propres | Consulter EDT, notes, paiements |
| `parent` | Enfants | Consulter données enfants, paiements |
| `accountant` | École | Enregistrer paiements, rapports financiers |

## Architecture Offline-First

### Queue Opérations

```typescript
interface QueuedOperation {
  id: string;
  resource: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  priority: number;
  retryCount: number;
  synced: boolean;
  createdAt: Date;
}
```

### Storage Adapters

- **Web**: IndexedDB via `idb` library
- **Mobile**: AsyncStorage via `@react-native-async-storage/async-storage`
- **Gateway**: SQLite via `better-sqlite3`

### Conflict Strategies

| Resource | Strategy | Details |
|----------|----------|---------|
| Payments | Append-only | Détection duplicates, fusion automatique |
| Grades | Versioning | Admin choisit version, historique conservé |
| Schedules | LWW/Manual | Draft: last-write-wins, Published: manuel |
| Attendance | Merge | Fusion configurable (teacher_wins, qr_wins, coexist) |

## Gateway LAN

### mDNS Discovery

```
Gateway Broadcast ─────────────▶ Browser/App
  - hostname: novaconnect-gateway.local
  - port: 8080
  - TXT records: { school_id, version }
```

### Failover Cloud

```
┌─────────────┐
│  Browser    │
└──────┬──────┘
       │
       │ try LAN
       ▼
┌─────────────────┐     NO      ┌──────────────┐
│ Gateway LAN     │◀───────────│ Cloud        │
│ - Check latency │             │ Supabase     │
│ - Health check  │             │              │
└─────────────────┘             └──────────────┘
       │ YES
       │ latency < 200ms
       ▼
┌─────────────────┐
│  Use Gateway    │
│  Mode: LAN      │
└─────────────────┘
```

### License Anti-Copie

```typescript
interface License {
  key: string; // UUID v4 + signature
  schoolId: string;
  hardwareFingerprint: string; // Machine ID + MAC addresses
  activatedAt: Date;
  expiresAt: Date;
  premiumModules: string[];
}
```

## Technologies

### Frontend
- **Web**: Next.js 14, React 19, TypeScript 5
- **Mobile**: Expo 50, React Native 0.76, TypeScript 5
- **UI**: TailwindCSS 3, shadcn/ui, React Native Paper
- **State**: Zustand, React Context, Supabase Client
- **Forms**: React Hook Form, Zod validation

### Backend
- **Database**: PostgreSQL 15 (Supabase)
- **Auth**: Supabase Auth (JWT + refresh tokens)
- **Storage**: Supabase Storage (S3-compatible)
- **Realtime**: Supabase Realtime (WebSockets)
- **Edge Functions**: Deno runtime (Supabase)

### Gateway
- **Runtime**: Bun (ultra-performant)
- **Server**: Hono (lightweight)
- **Database**: SQLite (local)
- **Sync**: Bidirectional with Supabase

### DevOps
- **Monorepo**: Turborepo
- **Package Manager**: pnpm
- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions
- **Hosting**: Vercel (web), Expo (mobile)
- **Monitoring**: Sentry
- **Testing**: Jest, Playwright

## Scalabilité

### Horizontal Scaling
- **Web**: Vercel auto-scaling (serverless)
- **Mobile**: Expo Updates (OTA)
- **Database**: Supabase pooling (max 60 connections)
- **Gateway**: Multi-instance derrière load balancer

### Vertical Scaling
- **Database**: Supabase tiers (Pro, Enterprise)
- **Storage**: Supabase Storage (100GB+)
- **Edge Functions**: Supabase (500K invocations/month+)

### Performance Optimizations
- **Caching**: Redis (future)
- **CDN**: Vercel Edge Network
- **Lazy Loading**: Next.js dynamic imports
- **Bundle Size**: Code splitting, tree shaking
- **Database Indexes**: Sur toutes les clés étrangères

## Sécurité

### Authentication
- JWT avec expiration courte (15 min)
- Refresh token rotation
- MFA (future)

### Authorization
- RLS policies sur toutes les tables
- Vérification rôle à chaque requête
- Pas de `USING (true)` sans justification

### Audit
- Triggers automatiques sur CRUD
- Logs complètes (user_id, action, resource, old_data, new_data)
- Export logs pour conformité

### Data Protection
- Chiffrement en transit (HTTPS/TLS)
- Chiffrement au repos (Supabase)
- Hash passwords (bcrypt)
- Secrets managment (env variables)

## Monitoring

### Métriques
- Uptime (99.9% target)
- Latency p95 (< 500ms)
- Error rate (< 0.1%)
- Sync queue size (< 100)
- Conflicts (< 10/day)

### Alertes
- Errors 5xx → PagerDuty
- Sync failures → Slack
- Payment conflicts → Email
- License expiry → 7 days before

## Conclusion

Cette architecture robuste permet à NovaConnect de :
- Gérer des centaines d'écoles
- Servir des milliers d'utilisateurs simultanés
- Fonctionner offline efficacement
- Basculer entre LAN et Cloud
- Sécuriser les données multi-tenant
- Scalabilité horizontale et verticale
