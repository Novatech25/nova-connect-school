# NovaConnect Monorepo

Monorepo Turborepo pour l'application NovaConnect multi-plateforme (Web + Mobile + PWA).

## 📋 Table of Contents

- [Structure](#structure)
- [Configuration Supabase](#configuration-supabase)
- [Packages](#packages)
- [Commandes](#commandes)
- [Conventions de nommage](#conventions-de-nommage)
- [Technologies](#technologies)

## Structure

```
novaconnect/
├── apps/
│   ├── web/          # Application Next.js 14+ (web)
│   └── mobile/       # Application Expo (iOS/Android/PWA)
├── packages/
│   ├── config/       # Configuration partagée (ESLint, Prettier, TS)
│   ├── core/         # Types et logique métier partagée
│   ├── ui/           # Composants UI partagés (Web + Mobile)
│   ├── data/         # Client Supabase et queries
│   └── sync/         # Synchronisation offline
├── package.json      # Configuration racine
├── turbo.json        # Configuration Turborepo
└── pnpm-workspace.yaml
```

## Docker (LAN)

- `docker-compose.yml` (racine) lance Web + Gateway. Par defaut: web sur `http://localhost:3001`, gateway sur `http://localhost:3002`.
- `apps/gateway/docker-compose.yml` lance uniquement le Gateway (pas l app web).
- Watchtower est desactive par defaut. Pour l activer: `docker compose --profile monitoring up`.

## Configuration Supabase

NovaConnect utilise Supabase comme backend avec une architecture multi-tenant stricte utilisant Row Level Security (RLS).

### Prérequis

1. **Installer Supabase CLI**

```bash
# macOS
brew install supabase/tap/supabase

# Windows
scoop install supabase

# Linux
curl -fsSL https://packages.supabase.com/api/installer.sh | bash
```

2. **Démarrer Supabase localement**

```bash
# Installer les dépendances
pnpm install

# Démarrer Supabase (postgres + API + Studio)
pnpm db:start
```

Cela démarre:
- PostgreSQL: `localhost:54322`
- API: `http://localhost:54321`
- Studio: `http://localhost:54323`
- Inbucket (emails): `http://localhost:54324`

3. **Configuration des variables d'environnement**

Copier le fichier `.env.example` vers `.env`:

```bash
cp .env.example .env
```

Les variables nécessaires sont configurées automatiquement pour le développement local.

### Migrations

```bash
# Appliquer toutes les migrations
pnpm db:migrate

# Ou utiliser Supabase CLI directement
supabase db push
```

**Migrations disponibles:**

1. `20250115000001_create_core_tables.sql` - Tables core (schools, users, roles, permissions, audit_logs)
2. `20250115000002_enable_rls_policies.sql` - Policies RLS multi-tenant
3. `20250115000003_create_audit_triggers.sql` - Triggers d'audit automatique

### Seed Data

```bash
# Charger les données de test (rôles, permissions, école exemple)
pnpm db:seed

# Ou
supabase db reset --seed
```

**Données incluses:**
- 7 rôles système (super_admin, school_admin, accountant, teacher, student, parent, supervisor)
- 40+ permissions (schools:*, users:*, grades:*, etc.)
- Matrice de permissions par rôle
- École exemple (Nouakchott)

### Types TypeScript

Après chaque modification du schéma, régénérer les types:

```bash
pnpm db:types
```

Cela met à jour `packages/data/src/types/database.generated.ts`.

### Commandes Base de Données

```bash
# Démarrer Supabase
pnpm db:start

# Arrêter Supabase
pnpm db:stop

# Reset complet (⚠️ supprime toutes les données)
pnpm db:reset

# Vérifier le statut
pnpm db:status

# Voir les logs
pnpm db:logs

# Ouvrir Supabase Studio
open http://localhost:54323
```

### Accéder à la base de données

```bash
# Via psql
psql postgresql://postgres:postgres@localhost:54322/postgres

# Via Supabase CLI
supabase db dump --dry-run  # Voir le schéma
supabase db dump            # Exporter le schéma
```

### Architecture Multi-Tenant

NovaConnect utilise une isolation stricte des tenants via RLS:

- **Chaque école** = un tenant (table `schools`)
- **Chaque utilisateur** appartient à une école (`users.school_id`)
- **Super admin** a `school_id = NULL` et peut accéder à toutes les écoles
- **RLS Policies** garantissent qu'une école ne voit que ses propres données
- **Audit Logs** tracent toutes les actions critiques

**Exemple de requête sécurisée:**

```typescript
import { getSupabaseClient } from '@novaconnect/data';
import { checkPermission } from '@novaconnect/data/helpers';

const supabase = getSupabaseClient();

// Vérifier la permission
const canCreate = await checkPermission(supabase, 'students', 'create');

if (!canCreate) {
  throw new Error('Permission denied');
}

// Créer un étudiant (RLS s'assure que school_id est correct)
const { data, error } = await supabase
  .from('students')
  .insert({
    first_name: 'Ahmed',
    last_name: 'Mohamed',
    // school_id est automatiquement défini par RLS
  });
```

### Documentation Supabase

- [Schema de la base de données](./docs/database-schema.md)
- [Policies RLS](./docs/rls-policies.md)
- [Migrations](./supabase/MIGRATIONS.md)
- [Guide Supabase local](./supabase/README.md)

### Déploiement

Pour déployer en production:

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Récupérer les clés API (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Mettre à jour `.env` avec les clés de production
4. Appliquer les migrations: `supabase db push --linked`
5. Générer les types: `pnpm db:types`

## Modules

### Module Emploi du Temps (EDT)

Le module EDT permet la création, gestion et publication des emplois du temps avec des fonctionnalités avancées:

**Fonctionnalités principales:**
- Création de créneaux horaires (prof + matière + classe + salle + horaires)
- Validation automatique des contraintes (anti-conflits, volumes horaires)
- Versioning et historique des modifications
- Publication atomique avec génération automatique des séances planifiées
- Intégration automatique avec le cahier de texte et la paie

**Tables de base de données:**
- `schedules` - Emplois du temps avec versioning
- `schedule_slots` - Créneaux horaires
- `schedule_versions` - Historique des versions
- `schedule_constraints` - Règles de validation
- `planned_sessions` - Séances planifiées générées

**Edge Functions:**
- `publish-schedule` - Publication atomique avec validation

**Documentation complète:** [docs/schedule-system.md](docs/schedule-system.md)

## Packages

| Package | Description |
|---------|-------------|
| `@novaconnect/config` | Configuration ESLint, Prettier, TypeScript |
| `@novaconnect/core` | Types, schémas Zod, utilitaires métier |
| `@novaconnect/ui` | Composants UI partagés (React + React Native) |
| `@novaconnect/data` | Client Supabase et React Query |
| `@novaconnect/sync` | Synchronisation offline avec queue |
| `@novaconnect/web` | Application web Next.js 14+ |
| `@novaconnect/mobile` | Application mobile Expo + PWA |

## Commandes

### Développement

```bash
# Lancer tous les projets en mode dev
pnpm dev

# Lancer uniquement l'app web
pnpm dev:web

# Lancer uniquement l'app mobile
pnpm dev:mobile
```

### Build

```bash
# Builder tous les projets
pnpm build

# Builder uniquement l'app web
pnpm build:web

# Builder uniquement l'app mobile
pnpm build:mobile
```

### Linting et type-checking

```bash
# Linter tous les projets
pnpm lint

# Vérifier les types TypeScript
pnpm type-check

# Formatter le code
pnpm format
```

### Nettoyage

```bash
# Nettoyer tous les builds et dépendances
pnpm clean
```

## Conventions de nommage

- **Apps**: `@novaconnect/{app-name}`
- **Packages**: `@novaconnect/{package-name}`
- **Workspaces**: `apps/*` et `packages/*`

## Prochaines étapes

1. Configuration de Supabase
2. Mise en place de l'authentification
3. Implémentation des features métier
4. Configuration du PWA pour mobile
5. Tests E2E

## Technologies

- **Monorepo**: Turborepo + pnpm workspaces
- **Web**: Next.js 14+ (App Router) + shadcn/ui
- **Mobile**: Expo SDK 52+ (React Native)
- **PWA**: Expo Web + Service Workers
- **Backend**: Supabase
- **State Management**: React Query
- **Validation**: Zod
- **Linting**: ESLint + Prettier
- **TypeScript**: Strict mode activé
