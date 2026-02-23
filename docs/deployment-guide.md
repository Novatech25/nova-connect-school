# Guide de Déploiement NovaConnect

## Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Architecture](#architecture)
4. [Configuration de l'Environnement](#configuration-de-lenvironnement)
5. [Déploiement Initial](#déploiement-initial)
6. [Opérations Continues](#opérations-continues)
7. [Dépannage](#dépannage)
8. [Maintenance](#maintenance)
9. [Annexes](#annexes)

## Vue d'ensemble

NovaConnect est un système de gestion scolaire multi-niveaux composé de :
- **Application Web** (Next.js sur Vercel)
- **Application Mobile** (React Native via Expo EAS)
- **Passerelle API** (Node.js)
- **Base de Données** (Supabase PostgreSQL)

Ce guide couvre le déploiement de tous les composants en production.

## Prérequis

### Comptes Requis

| Service | Objectif | Lien de Compte |
|---------|---------|---------------|
| **Supabase** | Base de données, Auth, Stockage | https://supabase.com |
| **Vercel** | Hébergement web | https://vercel.com |
| **Expo** | Builds mobiles | https://expo.dev |
| **Sentry** | Suivi des erreurs | https://sentry.io |
| **GitHub** | CI/CD | https://github.com |
| **Google Play** | Distribution Android | https://play.google.com/console |
| **App Store** | Distribution iOS | https://appstoreconnect.apple.com |

### Outils Requis

```bash
# Installer les outils requis
pnpm add -g supabase vercel eas-cli

# Vérifier l'installation
supabase --version
vercel --version
eas --version
```

### Exigences d'Accès

- [ ] Projet Supabase créé
- [ ] Compte d'équipe Vercel
- [ ] Compte Expo configuré
- [ ] Projet Sentry créé
- [ ] Dépôt GitHub configuré
- [ ] Comptes développeur pour les stores d'applications

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Utilisateurs                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Parents  │  │ Enseignants│ │ Étudiants│  ┌──────────┐   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │  Admins  │   │
│       │              │              │         └────┬─────┘   │
└───────┼──────────────┼──────────────┼─────────────┼────────┘
        │              │              │             │
┌───────┴──────────────┴──────────────┴─────────────┴────────┐
│                      Couche Client                         │
│  ┌────────────────┐         ┌────────────────┐            │
│  │   App Web      │         │  App Mobile    │            │
│  │  (Next.js)     │         │ (React Native) │            │
│  │   Vercel       │         │     Expo       │            │
│  └────────┬───────┘         └────────┬───────┘            │
└───────────┼───────────────────────────┼────────────────────┘
            │                           │
┌───────────┴───────────────────────────┴────────────────────┐
│                      Couche API                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │           Passerelle API (Optionnelle)            │    │
│  │         Limitation de Débit, Mise en Cache, Auth  │    │
│  └──────────────────────┬───────────────────────────┘    │
└─────────────────────────┼─────────────────────────────────┘
                          │
┌─────────────────────────┴─────────────────────────────────┐
│                    Couche de Données                      │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Supabase                             │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │    │
│  │  │PostgreSQL│  │   Auth   │  │ Stockage │      │    │
│  │  └──────────┘  └──────────┘  └──────────┘      │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

## Configuration de l'Environnement

### 1. Configuration Supabase

```bash
# Connexion à Supabase
supabase login

# Initialiser le projet
supabase init

# Lier au projet distant
supabase link --project-ref YOUR_PROJECT_REF

# Pousser le schéma de base de données
supabase db push

# Générer les types TypeScript
supabase gen types typescript > packages/data/src/types/database.generated.ts

# Charger les données de développement
supabase db reset --seed
```

**Variables d'Environnement** (enregistrer dans le gestionnaire de mots de passe) :
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://...
```

### 2. Configuration Vercel

```bash
# Connexion à Vercel
vercel login

# Installer le projet
vercel link

# Définir les variables d'environnement
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_APP_URL
vercel env add SENTRY_DSN
vercel env add SENTRY_AUTH_TOKEN
```

### 3. Configuration Expo/EAS

```bash
# Connexion à Expo
eas login

# Configurer le projet
eas init

# Build pour le développement
eas build --profile development --platform all
```

**Variables d'Environnement** (`apps/mobile/.env`) :
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### 4. Configuration Sentry

```bash
# Installer Sentry CLI
npm install -g @sentry/cli

# Connexion
sentry-cli login

# Créer les projets
# - novaconnect-web
# - novaconnect-mobile
# - novaconnect-gateway
```

## Déploiement Initial

### Phase 1 : Base de Données (Supabase)

**Durée** : 30 minutes

1. **Créer le Projet** :
   - Aller sur https://supabase.com
   - Cliquer sur "New Project"
   - Choisir l'organisation
   - Définir le nom du projet : `novaconnect-prod`
   - Définir le mot de passe de la base de données (enregistrer dans le gestionnaire de mots de passe)
   - Choisir la région (la plus proche des utilisateurs)
   - Attendre le provisionnement (~2 minutes)

2. **Appliquer les Migrations** :
   ```bash
   # Naviguer à la racine du projet
   cd NovaConnect

   # Lier au projet
   supabase link --project-ref YOUR_PROJECT_REF

   # Pousser le schéma
   supabase db push
   ```

3. **Activer RLS** :
   ```sql
   -- Vérifier que RLS est activé
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```

4. **Configurer l'Authentification** :
   - Aller vers Authentication → Settings
   - Activer l'authentification par e-mail
   - Configurer SMTP (pour les e-mails de production)
   - Définir les URL de redirection

5. **Vérifier** :
   ```bash
   # Tester la connexion à la base de données
   psql $DATABASE_URL -c "SELECT version();"
   ```

### Phase 2 : Application Web (Vercel)

**Durée** : 15 minutes

1. **Connecter le Dépôt** :
   - Aller sur https://vercel.com
   - Cliquer sur "Add New Project"
   - Importer le dépôt GitHub
   - Configurer le projet :
     - Framework Preset : Next.js
     - Root Directory : `apps/web`
     - Build Command : `pnpm build:web`
     - Output Directory : `.next`

2. **Définir les Variables d'Environnement** :
   ```
   SUPABASE_URL
   SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_APP_URL
   SENTRY_DSN
   SENTRY_AUTH_TOKEN
   ```

3. **Déployer** :
   ```bash
   # Déployer en production
   ./scripts/deploy-web.sh production

   # Ou via Vercel CLI
   vercel --prod
   ```

4. **Vérifier le Déploiement** :
   - Vérifier l'URL de déploiement
   - Exécuter le contrôle de santé : `curl https://your-app.vercel.app/api/health`
   - Tester les flux utilisateur clés
   - Vérifier Sentry pour les erreurs

### Phase 3 : Applications Mobiles (Expo EAS)

**Durée** : 1-2 heures (première fois)

#### Configuration Android

1. **Configurer EAS** :
   ```bash
   cd apps/mobile
   eas build:configure
   ```

2. **Mettre à jour `eas.json`** :
   ```json
   {
     "build": {
       "production": {
         "android": {
           "buildType": "app-bundle"
         }
       }
     }
   }
   ```

3. **Build APK** (pour les tests) :
   ```bash
   eas build --platform android --profile preview
   ```

4. **Build Bundle de Production** :
   ```bash
   eas build --platform android --profile production
   ```

5. **Déployer sur Play Store** :
   - Aller sur Google Play Console
   - Créer une nouvelle application
   - Télécharger le fichier AAB
   - Compléter la fiche de la boutique
   - Soumettre pour examen

#### Configuration iOS

1. **Configurer Apple Developer** :
   - Créer un App ID dans le portail Apple Developer
   - Créer des profils de provisionnement
   - Mettre à jour `eas.json` avec les identifiants Apple

2. **Build pour TestFlight** :
   ```bash
   eas build --platform ios --profile production
   ```

3. **Déployer sur TestFlight** :
   - Aller sur App Store Connect
   - Créer une nouvelle application
   - Télécharger l'IPA via EAS
   - Ajouter des testeurs
   - Soumettre pour examen bêta

4. **Déployer sur l'App Store** :
   - Compléter la fiche de l'App Store
   - Télécharger les captures d'écran
   - Soumettre pour examen

### Phase 4 : Surveillance et Suivi des Erreurs

**Durée** : 30 minutes

1. **Configurer les Projets Sentry** :
   ```bash
   # L'application web est déjà configurée via sentry.client.config.ts
   # Mobile configuré via sentry.config.js
   # La passerelle configurée via sentry.config.js
   ```

2. **Vérifier le Suivi des Erreurs** :
   - Déclencher une erreur de test dans l'application web
   - Déclencher une erreur de test dans l'application mobile
   - Vérifier que les erreurs apparaissent dans Sentry
   - Tester la configuration des alertes

3. **Configurer les Alertes** :
   - Erreurs critiques : PagerDuty/Slack
   - Taux d'erreur élevé : E-mail
   - Problèmes de performance : E-mail

## Opérations Continues

### Opérations Quotidiennes

**Liste de Vérification du Matin** :
- [ ] Vérifier la page de statut : https://status.novaconnect.com
- [ ] Réviser Sentry pour les erreurs nocturnes
- [ ] Vérifier les journaux de déploiement
- [ ] Surveiller les métriques clés (temps de réponse, taux d'erreur)

**Tout au Long de la Journée** :
- [ ] Surveiller les taux d'erreur dans Sentry
- [ ] Vérifier les métriques Supabase
- [ ] Réviser les tickets de support
- [ ] Surveiller les performances du système

### Opérations Hebdomadaires

**Lundi** :
- [ ] Réviser les métriques hebdomadaires
- [ ] Vérifier le statut des sauvegardes
- [ ] Réviser les journaux de sécurité
- [ ] Point d'équipe sur les problèmes

**Vendredi** :
- [ ] Déployer les mises à jour en file d'attente
- [ ] Tester la restauration de sauvegarde
- [ ] Mettre à jour la documentation
- [ ] Planifier le travail de la semaine prochaine

### Opérations Mensuelles

- [ ] Audit de sécurité (voir Listes de Vérification de Sécurité)
- [ ] Révision de la conformité des licences
- [ ] Révision de l'optimisation des coûts
- [ ] Optimisation des performances
- [ ] Révision des commentaires utilisateurs
- [ ] Test des sauvegardes
- [ ] Mises à jour de la documentation

### Processus de Déploiement

**Pré-Déploiement** :
1. Créer une branche de fonctionnalité
2. Apporter les modifications
3. Tester localement
4. Créer une pull request
5. Révision du code
6. Fusionner vers main

**Déploiement** :
```bash
# Déploiement Web
./scripts/deploy-web.sh production

# Déploiement Mobile
./scripts/deploy-mobile.sh all production
```

**Post-Déploiement** :
1. Exécuter les tests de fumée
2. Surveiller les taux d'erreur
3. Vérifier les métriques de performance
4. Être prêt à annuler

## Dépannage

### Problèmes Courants

#### Problème : Échec du Déploiement

**Symptômes** : Le build échoue pendant le déploiement

**Solutions** :
1. Vérifier les journaux de build
2. Vérifier les variables d'environnement
3. Tester le build localement
4. Vérifier les changements de dépendances récents

```bash
# Test de build local
pnpm build:web

# Vérifier les erreurs
pnpm type-check
pnpm lint
```

#### Problème : Échec de la Connexion à la Base de Données

**Symptômes** : L'API renvoie des erreurs 500, erreurs de connexion à la base de données

**Solutions** :
1. Vérifier la page de statut Supabase
2. Vérifier la chaîne de connexion
3. Vérifier les limites du pool de connexions
4. Redémarrer le pool de connexions

```bash
# Tester la connexion
psql $DATABASE_URL -c "SELECT 1;"

# Vérifier le nombre de connexions
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

#### Problème : Taux d'Erreur Élevé

**Symptômes** : Augmentation des erreurs dans Sentry, plaintes des utilisateurs

**Solutions** :
1. Identifier les erreurs courantes
2. Vérifier les déploiements récents
3. Réviser les changements de code
4. Annuler si nécessaire

```bash
# Annulation rapide
./scripts/rollback.sh web production
```

#### Problème : Performance Lente

**Symptômes** : Chargement lent des pages, délais d'attente

**Solutions** :
1. Vérifier les performances des requêtes de base de données
2. Réviser la mise en cache CDN
3. Vérifier les ressources du serveur
4. Optimiser les requêtes lentes

```sql
-- Trouver les requêtes lentes
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Matrice d'Escalade

| Gravité du Problème | Temps de Réponse | Escalade |
|---------------------|------------------|----------|
| P1 - Critique | 15 minutes | CTO, CEO |
| P2 - Élevé | 1 heure | Engineering Manager |
| P3 - Moyen | 4 heures | Team Lead |
| P4 - Faible | 1 jour ouvrable | Individual Contributor |

## Maintenance

### Tâches de Maintenance Régulières

**Hebdomadaire** :
- Réviser et déployer les mises à jour
- Vérifier la santé du système
- Réviser les rapports d'erreurs
- Mettre à jour la documentation

**Mensuel** :
- Mises à jour de sécurité
- Optimisation des performances
- Test des sauvegardes
- Révision de la conformité des licences

**Trimestriel** :
- Mises à niveau de versions majeures
- Audit de sécurité
- Audit des performances
- Optimisation des coûts

**Annuel** :
- Exercice de reprise après sinistre
- Révision de l'architecture
- Révision des contrats fournisseurs
- Mise à jour de la formation de l'équipe

### Procédures de Mise à Jour

**Mises à Jour des Dépendances** :
```bash
# Vérifier les mises à jour
pnpm outdated

# Mettre à jour les dépendances
pnpm update

# Tester les mises à jour
pnpm test
pnpm type-check
pnpm build

# Déployer si les tests réussissent
./scripts/deploy-web.sh staging
```

**Migrations de Base de Données** :
```bash
# Créer une migration
supabase migration new describe_change

# Appliquer localement
supabase db reset

# Tester minutieusement
pnpm test:e2e

# Appliquer en production
supabase db push
```

## Documentation

### Documentation Essentielle

**Déploiement** :
- [Runbook de Déploiement](runbooks/deployment.md)
- [Réponse aux Incidents](runbooks/incident-response.md)
- [Runbook de Mise à l'Échelle](runbooks/scaling.md)
- [Sauvegarde et Restauration](runbooks/backup-restore.md)

**Sécurité** :
- [Liste de Vérification RLS](security/rls-checklist.md)
- [Liste de Vérification GDPR](security/gdpr-checklist.md)
- [Sécurité Générale](security/general-checklist.md)
- [Conformité des Licences](security/license-checklist.md)

**Développement** :
- [Architecture](architecture/overview.md)
- [Documentation API](api/rest-api.md)
- [Schéma de Base de Données](database/schemas.md)
- [Guide de Test](testing.md)

### Maintenir la Documentation à Jour

- Mettre à jour les runbooks après les incidents
- Documenter les nouvelles procédures
- Réviser trimestriellement
- Assigner des responsables de la documentation

## Support et Ressources

### Ressources Internes

- **Équipe d'Ingénierie** : engineering@novaconnect.com
- **DevOps** : devops@novaconnect.com
- **Support** : support@novaconnect.com

### Ressources Externes

**Support Plateforme** :
- Supabase : https://supabase.com/support
- Vercel : https://vercel.com/support
- Expo : https://expo.dev/support
- Sentry : https://sentry.io/support/

**Communauté** :
- Chaînes Discord/Slack
- Stack Overflow
- GitHub Issues

### Contacts d'Urgence

- **Commandant d'Incident** : [Nom, Téléphone]
- **CTO** : [Nom, Téléphone]
- **Lead DevOps** : [Nom, Téléphone]

## Annexes

### Annexe A : Variables d'Environnement

Liste complète des variables d'environnement requises :

**Application Web** :
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
SENTRY_DSN
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
```

**Application Mobile** :
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_SENTRY_DSN
```

**Passerelle** :
```
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SENTRY_DSN
```

### Annexe B : Commandes de Référence Rapide

```bash
# Base de Données
supabase db push                    # Pousser les migrations
supabase db reset                   # Réinitialiser la base de données
supabase gen types typescript        # Générer les types

# Déploiement Web
vercel --prod                       # Déployer en production
vercel ls                           # Lister les déploiements
vercel rollback                     # Annuler le déploiement

# Build Mobile
eas build --platform all            # Build les deux plateformes
eas submit --platform all           # Soumettre aux stores

# Tests
pnpm test                           # Exécuter les tests unitaires
pnpm test:e2e                       # Exécuter les tests E2E
pnpm type-check                     # Vérification des types
pnpm lint                           # Linter le code
```

### Annexe C : Annuaire des Contacts

| Rôle | Nom | E-mail | Téléphone |
|------|-----|--------|-----------|
| CTO | | | |
| Engineering Lead | | | |
| DevOps Lead | | | |
| Product Manager | | | |
| Support Lead | | | |

### Annexe D : Informations Fournisseurs

| Service | ID de Compte | Plan | Date de Renouvellement | Coût |
|---------|-------------|------|----------------------|------|
| Supabase | | Pro | | |
| Vercel | | Pro | | |
| Expo | | | | |
| Sentry | | Team | | |
| GitHub | | Team | | |

### Annexe E : Index des Runbooks

- [Runbook de Déploiement](runbooks/deployment.md)
- [Réponse aux Incidents](runbooks/incident-response.md)
- [Runbook de Mise à l'Échelle](runbooks/scaling.md)
- [Sauvegarde et Restauration](runbooks/backup-restore.md)

---

**Version du Document** : 1.0
**Dernière Mise à Jour** : 2024-10-15
**Prochaine Révision** : 2025-01-15
**Maintenu Par** : Équipe DevOps
