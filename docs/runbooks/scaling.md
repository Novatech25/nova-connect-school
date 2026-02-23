# Runbook de Mise à l'Échelle

## Vue d'ensemble

Ce runbook fournit des procédures pour la mise à l'échelle horizontale et verticale de l'infrastructure NovaConnect afin de gérer une charge accrue.

## Déclencheurs de Mise à l'Échelle

### Métriques à Surveiller

| Métrique | Seuil d'Avertissement | Seuil Critique | Action Requise |
|----------|----------------------|----------------|----------------|
| Utilisation CPU | 70% | 90% | Augmenter la capacité |
| Utilisation Mémoire | 75% | 90% | Augmenter la capacité |
| Temps de Réponse (p95) | 500ms | 1000ms | Augmenter la capacité |
| Taux d'Erreur | 1% | 5% | Investiguer + Augmenter |
| Connexions Base de Données | 80% | 95% | Augmenter la base de données |
| Profondeur de File | 1000 | 5000 | Augmenter les workers |

### Configuration de la Mise à l'Échelle Automatique

**Vercel (Application Web)** :
```bash
# Configurer via vercel.json ou le tableau de bord
# Vercel gère la mise à l'échelle horizontale automatiquement
```

**Supabase (Base de Données)** :
- Pool de connexions : PgBroker (par défaut)
- Répliques de lecture : Disponibles dans le plan Pro
- Mise à l'échelle automatique du disque : Automatique

## Mise à l'Échelle Horizontale

### Application Web (Next.js sur Vercel)

Vercel gère la mise à l'échelle horizontale automatiquement en fonction de la demande :
- **Edge Functions** : Mise à l'échelle automatique globale
- **Serverless Functions** : Mise à l'échelle automatique par région
- **Actifs Statiques** : Servis depuis le CDN

**Aucune mise à l'échelle manuelle requise pour l'application web**

### API Gateway

Si une passerelle dédiée est exécutée :

```bash
# Mise à l'échelle via la plateforme de déploiement
# Exemple Kubernetes :
kubectl scale deployment gateway --replicas=5

# Vérifier le statut des pods
kubectl get pods -l app=gateway
```

### Workers d'Arrière-Plan

```bash
# Mettre à l'échelle des processus worker
pm2 scale novaconnect-worker 4

# Ou via systemd
sudo systemctl scale novaconnect-worker=4
```

## Mise à l'Échelle Verticale

### Base de Données (Supabase)

**Mettre à Niveau le Plan** :
1. Aller au tableau de bord du projet Supabase
2. Naviguer vers Settings → Database
3. Sélectionner "Upgrade Plan"
4. Choisir le nouveau plan
5. Réviser la chronologie de migration
6. Planifier une fenêtre de maintenance

**Considérations** :
- La migration peut causer une indisponibilité (généralement < 1 heure)
- Sauvegarde avant la mise à niveau
- Tester d'abord en staging
- Notifier les utilisateurs de la fenêtre de maintenance

**Commandes** :
```bash
# Vérifier les limites actuelles
psql $DATABASE_URL -c "SHOW max_connections;"

# Surveiller l'utilisation des connexions
psql $DATABASE_URL -c "
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';
"

# Vérifier la taille de la base de données
psql $DATABASE_URL -c "
SELECT pg_size_pretty(pg_database_size('postgres'));
"
```

## Stratégie de Mise en Cache

### Mise en Cache Redis

**Implémenter Redis pour** :
- Stockage de session
- Mise en cache des réponses API
- Données en temps réel
- Limitation de débit

**Configuration** :
```bash
# Ajouter Redis au projet (ex: Upstash)
# Configurer les variables d'environnement
REDIS_URL=redis://...

# Implémenter la mise en cache dans les routes API
```

**Invalidation de Cache** :
```typescript
// Expiration basée sur le temps
cache.set('key', data, { ttl: 300 }); // 5 minutes

// Invalidation basée sur les événements
cache.invalidate('schools:*'); // Invalider tous les caches d'écoles
```

### Mise en Cache CDN

**Réseau Edge Vercel** :
- Actifs statiques mis en cache automatiquement
- Réponses API mises en cache avec en-têtes Cache-Control
- Next.js ISR (Incremental Static Regeneration)

**Implémentation** :
```typescript
// Dans les routes API
export async function GET() {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  });
}
```

## Optimisation de la Base de Données

### Pool de Connexions

Supabase fournit un pool de connexions via PgBroker :
```
postgresql://postgres.project-ref:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### Optimisation des Requêtes

**Identifier les Requêtes Lentes** :
```sql
-- Activer la journalisation des requêtes
ALTER DATABASE postgres SET log_min_duration_statement = 1000;

-- Voir les requêtes lentes
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Ajouter des Index** :
```sql
-- Ajouter un index pour les colonnes fréquemment interrogées
CREATE INDEX CONCURRENTLY idx_students_school_grade
ON students(school_id, grade_id);

-- Ajouter un index partiel pour les requêtes filtrées
CREATE INDEX CONCURRENTLY idx_active_students
ON students(school_id)
WHERE status = 'active';
```

### Répliques de Lecture

Pour les charges de travail intensive en lecture, utiliser les répliques de lecture :
1. Activer dans le tableau de bord Supabase
2. Mettre à jour la chaîne de connexion pour les opérations de lecture
3. Router les lectures vers la réplique, les écritures vers le primaire

```typescript
// Exemple : Lire depuis la réplique
const replicaClient = createClient(REPLICA_URL);
const data = await replicaClient.from('students').select('*');

// Écrire vers le primaire
const primaryClient = createClient(PRIMARY_URL);
await primaryClient.from('students').insert({...});
```

## Test de Charge

### Avant la Mise à l'Échelle

1. **Établir une Ligne de Base** :
   ```bash
   # Exécuter un test de charge
   k6 run tests/load/scenarios.js
   ```

2. **Identifier les Goulets d'Étranglement** :
   - Utilisation CPU
   - Utilisation mémoire
   - Performance des requêtes de base de données
   - E/S Réseau

3. **Définir les Objectifs de Mise à l'Échelle** :
   - Utilisateurs concurrents attendus
   - Requêtes par seconde attendues
   - Temps de réponse acceptables

### Script de Test de Charge (k6)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '5m', target: 100 },   // Monter à 100 utilisateurs
    { duration: '10m', target: 100 },  // Rester à 100 utilisateurs
    { duration: '5m', target: 500 },   // Monter à 500 utilisateurs
    { duration: '10m', target: 500 },  // Rester à 500 utilisateurs
    { duration: '5m', target: 0 },     // Descendre
  ],
};

export default function() {
  // Tester le endpoint de la liste des étudiants
  let res = http.get('https://api.novaconnect.com/v1/students', {
    headers: { 'Authorization': `Bearer ${__ENV.API_TOKEN}` }
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

## Liste de Vérification de Mise à l'Échelle

### Pré-Mise à l'Échelle
- [ ] Métriques actuelles analysées
- [ ] Goulets d'étranglement identifiés
- [ ] Objectifs de mise à l'échelle définis
- [ ] Tests de charge effectués
- [ ] Implications coûts révisées
- [ ] Plan d'annulation préparé

### Pendant la Mise à l'Échelle
- [ ] Sauvegarde créée
- [ ] Surveillance renforcée
- [ ] Équipe notifiée
- [ ] Processus de mise à l'échelle documenté
- [ ] Performance suivie

### Post-Mise à l'Échelle
- [ ] Performance validée
- [ ] Optimisation des coûts vérifiée
- [ ] Documentation mise à jour
- [ ] Runbook révisé si nécessaire
- [ ] Post-mortem effectué

## Optimisation des Coûts

### Dimensionnement Approprié

**Révision Régulière** :
- Révision mensuelle des coûts
- Analyse de l'utilisation des ressources
- Redimensionner les ressources surdimensionnées

**Optimisation des Coûts Vercel** :
- Réviser l'utilisation de la bande passante
- Optimiser les tailles d'images
- Implémenter la mise en cache
- Utiliser Edge Functions lorsque possible

**Optimisation des Coûts Supabase** :
- Surveiller la taille de la base de données
- Archiver les anciennes données
- Optimiser les requêtes
- Utiliser le pool de connexions

### Limites de Mise à l'Échelle Automatique

Définir des limites maximales pour contrôler les coûts :
```yaml
# Exemple HPA Kubernetes
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Surveillance des Événements de Mise à l'Échelle

### Métriques à Suivre

**Avant la Mise à l'Échelle** :
- Métriques de performance de base
- Utilisation des ressources
- Nombre d'utilisateurs
- Taux de requêtes

**Pendant la Mise à l'Échelle** :
- Événements de mise à l'échelle
- Changements de performance
- Taux d'erreur
- Impact utilisateur

**Après la Mise à l'Échelle** :
- Impact sur les coûts
- Amélioration de la performance
- Utilisation des ressources
- Retour sur investissement

### Configuration du Tableau de Bord

Créer des tableaux de bord de surveillance avec :
- CPU, Mémoire, Utilisation du disque
- Métriques de requête/réponse
- Taux d'erreur
- Performance de la base de données
- Coût par requête

## Reprise après Sinistre

### Haute Disponibilité

**Déploiement Multi-Région** :
- Déployer dans plusieurs régions
- Utiliser le CDN pour la distribution globale
- Implémenter le basculement inter-régions

**Haute Disponibilité de la Base de Données** :
- Activer le basculement automatique
- Utiliser les répliques de lecture
- Tests réguliers des sauvegardes

### Stratégie de Sauvegarde

**Planification des Sauvegardes** :
- Continue : Archivage WAL
- Quotidienne : Sauvegarde complète de la base de données
- Hebdomadaire : Sauvegarde dans une région séparée

**Tests de Restauration** :
- Test de restauration mensuel
- Documenter RTO/RPO
- Mettre à jour le runbook en fonction des résultats

## Dépannage des Problèmes de Mise à l'Échelle

### Problème : La Mise à l'Échelle ne Fonctionne Pas

**Symptômes** : Charge accrue mais la performance ne s'améliore pas

**Solutions** :
1. Vérifier si la mise à l'échelle automatique est activée
2. Vérifier que les limites de mise à l'échelle ne sont pas atteintes
3. Vérifier les contraintes de ressources (CPU, Mémoire)
4. Réviser les limites de connexions de la base de données
5. Vérifier les requêtes lentes empêchant la mise à l'échelle

### Problème : Coûts Élevés Après la Mise à l'Échelle

**Symptômes** : Augmentation inattendue des coûts après la mise à l'échelle

**Solutions** :
1. Réviser l'utilisation des ressources
2. Réduire la capacité des ressources sous-utilisées
3. Implémenter la mise en cache pour réduire la charge
4. Optimiser les requêtes
5. Envisager des instances réservées pour les charges de travail stables

### Problème : Dégradation de la Performance Après la Mise à l'Échelle

**Symptômes** : Performance pire après l'augmentation de capacité

**Solutions** :
1. Vérifier les contentions de verrous de la base de données
2. Réviser la configuration du pool de connexions
3. Vérifier les requêtes N+1
4. Réviser les taux de succès du cache
5. Vérifier les goulets d'étranglement réseau

## Ressources

- **Mise à l'Échelle Vercel** : https://vercel.com/docs/concepts/limits
- **Mise à l'Échelle Supabase** : https://supabase.com/docs/guides/platform/scale-to-zero
- **Performance Next.js** : https://nextjs.org/docs/app/building-your-application/optimizing
- **Performance PostgreSQL** : https://wiki.postgresql.org/wiki/Performance_Optimization

## Dernière Mise à Jour

- Date : 2024-10-15
- Version : 1.0
- Dernière Mise à l'Échelle : [Date]
- Prochaine Révision : [Date]

## Annexes

### Annexe A : Lignes de Base de Performance

### Annexe B : Scénarios de Test de Charge

### Annexe C : Stratégies d'Optimisation des Coûts

### Annexe D : Journal des Événements de Mise à l'Échelle
