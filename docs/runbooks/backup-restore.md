# Runbook de Sauvegarde et Restauration

## Vue d'ensemble

Ce runbook fournit des procédures pour sauvegarder et restaurer les données NovaConnect sur tous les composants (base de données, stockage de fichiers, configuration).

## Stratégie de Sauvegarde

### Composants de Sauvegarde

| Composant | Type | Fréquence | Rétention | Emplacement |
|-----------|------|-----------|-----------|------------|
| Base de Données PostgreSQL | Complète Quotidienne | 35 jours | Supabase (automatique) |
| WAL PostgreSQL | Continue | 35 jours | Supabase (automatique) |
| Stockage de Fichiers | Continue | 35 jours | Supabase Storage |
| Variables d'Environnement | Manuel | Par changement | Git (chiffré) |
| Fichiers de Configuration | Git | Permanente | Dépôt Git |
| Artefacts Déployés | Automatique | Par déploiement | Vercel/Expo |

### Sauvegardes Automatisées

**Base de Données Supabase** :
- Sauvegardée automatiquement quotidiennement
- Récupération à un moment donné disponible (jusqu'à 35 jours)
- Sauvegardes stockées dans une région séparée pour la redondance
- Aucune intervention manuelle requise

**Vérification** :
```bash
# Vérifier le statut de sauvegarde via le tableau de bord Supabase
# Ou via CLI :
supabase db dumps
```

## Procédures de Sauvegarde Manuelle

### Sauvegarde de la Base de Données

```bash
# Créer une sauvegarde manuelle
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Compresser la sauvegarde
gzip backup_$(date +%Y%m%d).sql

# Sauvegarde avec format personnalisé (meilleur pour la restauration)
pg_dump -Fc $DATABASE_URL -f backup_$(date +%Y%m%d).dump

# Sauvegarder des tables spécifiques
pg_dump -t students -t grades $DATABASE_URL > selective_backup.sql
```

### Sauvegarde du Stockage de Fichiers

```bash
# Lister tous les fichiers dans le stockage Supabase
supabase storage ls --bucket-id default

# Télécharger tous les fichiers
supabase storage cp --recursive supabase://default/ ./backup_files/

# Créer une archive
tar -czf storage_backup_$(date +%Y%m%d).tar.gz ./backup_files/
```

### Sauvegarde des Variables d'Environnement

```bash
# Exporter les variables d'environnement
echo "# Sauvegarde d'Environnement - $(date)" > env_backup_$(date +%Y%m%d).txt
printenv | grep -E "^(SUPABASE|VERCEL|EXPO|SENTRY)" >> env_backup_$(date +%Y%m%d).txt

# Chiffrer la sauvegarde
gpg --symmetric --cipher-algo AES256 env_backup_$(date +%Y%m%d).txt

# Stocker dans un endroit sécurisé (ex: gestionnaire de mots de passe)
```

### Sauvegarde de Configuration

```bash
# Sauvegarder les migrations Supabase
cp -r supabase/migrations/ ./backup/migrations_$(date +%Y%m%d)/

# Sauvegarder les configurations de déploiement
cp vercel.json ./backup/
cp apps/mobile/eas.json ./backup/
cp .github/workflows/*.yml ./backup/
```

## Procédures de Restauration

### Restauration de la Base de Données

#### Depuis une Sauvegarde Supabase (Recommandé)

```bash
# Via le Tableau de Bord Supabase :
# 1. Aller au tableau de bord du projet
# 2. Naviguer vers Database → Backups
# 3. Sélectionner le point de sauvegarde
# 4. Cliquer sur "Restore"
# 5. Confirmer l'opération de restauration
```

#### depuis une Sauvegarde Manuelle

```bash
# Restaurer depuis un dump SQL
psql $DATABASE_URL < backup_20241015.sql

# Restaurer depuis un dump compressé
gunzip -c backup_20241015.sql.gz | psql $DATABASE_URL

# Restaurer depuis un dump au format personnalisé
pg_restore -d $DATABASE_URL backup_20241015.dump

# Restaurer des tables spécifiques
psql $DATABASE_URL < selective_backup.sql
```

### Récupération à un Moment Donné

```bash
# Récupérer la base de données à un moment précis
psql $DATABASE_URL
# Puis exécuter :
# SELECT pg_restore_database('target_timestamp', options);
```

### Restauration du Stockage de Fichiers

```bash
# Restaurer les fichiers depuis la sauvegarde
supabase storage cp --recursive ./backup_files/ supabase://default/

# Restaurer un fichier spécifique
supabase storage cp ./backup_files/path/to/file.pdf supabase://default/path/to/file.pdf
```

### Restauration des Variables d'Environnement

```bash
# Déchiffrer la sauvegarde
gpg --decrypt env_backup_20241015.txt.gpg > env_backup_20241015.txt

# Charger les variables d'environnement
set -a
source env_backup_20241015.txt
set +a
```

## Scénarios de Reprise après Sinistre

### Scénario 1 : Suppression Accidentelle de Données

**Situation** : Un utilisateur supprime accidentellement des données importantes (ex: tous les étudiants d'une école)

**Étapes de Récupération** :

1. **Arrêter les Opérations** :
   ```bash
   # Mettre le système en mode maintenance
   # Via le tableau de bord Vercel
   ```

2. **Évaluer les Dommages** :
   ```sql
   -- Vérifier ce qui a été supprimé
   SELECT * FROM audit_logs
   WHERE action = 'DELETE'
     AND resource_type = 'students'
     AND timestamp >= NOW() - INTERVAL '1 hour';
   ```

3. **Identifier le Point de Récupération** :
   - Trouver la sauvegarde avant la suppression
   - Vérifier l'intégrité de la sauvegarde
   - Noter l'horodatage exact

4. **Restaurer la Base de Données** :
   ```bash
   # Option A : Récupération à un moment donné (préféré)
   # Via le tableau de bord Supabase

   # Option B : Restaurer depuis une sauvegarde
   pg_restore -d $DATABASE_URL backup_before_incident.dump
   ```

5. **Vérifier la Récupération** :
   ```sql
   -- Vérifier les données restaurées
   SELECT COUNT(*) FROM students WHERE school_id = 'affected_school';
   ```

6. **Reprendre les Opérations** :
   - Sortir le système du mode maintenance
   - Surveiller les problèmes
   - Notifier les parties prenantes

### Scénario 2 : Corruption de la Base de Données

**Situation** : La base de données devient corrompue ou incohérente

**Étapes de Récupération** :

1. **Identifier la Corruption** :
   ```sql
   -- Vérifier la corruption
   SELECT * FROM students WHERE id IS NULL;

   -- Vérifier les contraintes
   SELECT COUNT(*) FROM students WHERE school_id NOT IN (SELECT id FROM schools);
   ```

2. **Arrêter les Écritures** :
   ```bash
   # Activer le mode lecture seule
   # Via le tableau de bord Supabase
   ```

3. **Restaurer depuis la Dernière Bonne Sauvegarde Connue** :
   ```bash
   # Restaurer vers la sauvegarde avant la corruption
   pg_restore -d $DATABASE_URL last_good_backup.dump
   ```

4. **Appliquer le Journal des Transactions** (si disponible) :
   ```bash
   # Rejouer les transactions jusqu'au point de corruption
   # Via la récupération à un moment donné Supabase
   ```

5. **Vérifier l'Intégrité des Données** :
   ```sql
   -- Exécuter des contrôles d'intégrité des données
   -- Vérifier les contraintes
   -- Vérifier les clés étrangères
   ```

### Scénario 3 : Panne Complète du Système

**Situation** : L'ensemble du système devient indisponible (ex: panne du fournisseur cloud)

**Étapes de Récupération** :

1. **Évaluer la Portée** :
   - Déterminer les services affectés
   - Vérifier la page de statut du fournisseur cloud
   - Estimer le temps de récupération

2. **Initier le Basculement** (si disponible) :
   ```bash
   # Basculer vers la région/réplica de secours
   # Mettre à jour le DNS pour pointer vers le secours
   ```

3. **Restaurer les Services par Ordre de Priorité** :
   1. Base de données (critique)
   2. API Gateway
   3. Application Web
   4. Backend Application Mobile

4. **Vérifier la Fonctionnalité** :
   ```bash
   # Contrôles de santé
   curl https://api.novaconnect.com/api/health

   # Connectivité de la base de données
   psql $DATABASE_URL -c "SELECT 1;"
   ```

5. **Communiquer le Statut** :
   - Mettre à jour la page de statut
   - Notifier les parties prenantes
   - Fournir une ETA

## Tests de Sauvegarde

### Test Mensuel des Sauvegardes

**Procédure** :
1. Sélectionner une sauvegarde aléatoire du mois précédent
2. Restaurer dans l'environnement de staging
3. Vérifier l'intégrité des données
4. Tester les fonctionnalités critiques
5. Documenter les résultats

**Liste de Vérification du Test** :
- [ ] La sauvegarde peut être restaurée
- [ ] Intégrité des données vérifiée
- [ ] L'application fonctionne correctement
- [ ] Performance acceptable
- [ ] Aucune perte de données détectée

**Documentation** :
```markdown
# Test de Sauvegarde - [Date]

## Sauvegarde Testée
- Date : [Date de sauvegarde]
- Type : [Base de Données/Fichiers/Complète]
- Taille : [Taille de sauvegarde]

## Résultats du Test
- Succès de Restauration : [Oui/Non]
- Intégrité des Données : [Réussite/Échec]
- Tests de l'Application : [Réussite/Échec]
- Problèmes Trouvés : [Lister les problèmes]

## Performance
- Temps de Restauration : [Durée]
- Temps de Vérification : [Durée]
- Temps d'Indisponibilité Total (si réel) : [Durée]

## Recommandations
- [Améliorations nécessaires]
```

### Exercice Annuel de Reprise après Sinistre

**Scénario** : Simulation de perte complète du système

**Étapes** :
1. Simuler une panne complète du système
2. Documenter toutes les étapes de récupération
3. Mesurer le temps de récupération complète
4. Identifier les lacunes dans les procédures
5. Mettre à jour le runbook en fonction des résultats
6. Former l'équipe aux procédures

## Politique de Rétention des Sauvegardes

### Calendrier de Rétention

| Type de Sauvegarde | Période de Rétention | Total Stocké |
|-------------------|---------------------|--------------|
| Sauvegardes Quotidiennes | 35 jours | 35 sauvegardes |
| Snapshots Hebdomadaires | 12 semaines | 12 sauvegardes |
| Archives Mensuelles | 12 mois | 12 sauvegardes |
| Archives Annuelles | 7 ans | 7 sauvegardes |

### Procédure d'Archivage

```bash
# Créer une archive mensuelle
pg_dump -Fc $DATABASE_URL | gzip > archive_monthly_$(date +%Y%m).dump.gz

# Télécharger vers le stockage à long terme (ex: AWS S3 Glacier)
aws s3 cp archive_monthly_202410.dump.gz s3://novaconnect-backups/glacier/

# Documenter l'archive
echo "Archive créée : $(date)" >> archive_log.txt
```

### Procédure de Nettoyage

```bash
# Supprimer les anciennes sauvegardes (après vérification)
find /backups/ -name "backup_*.sql" -mtime +35 -delete

# Vérifier avant suppression
ls -lh /backups/
```

## Considérations de Sécurité

### Chiffrement des Sauvegardes

- Toutes les sauvegardes chiffrées au repos (par défaut Supabase)
- Sauvegardes manuelles chiffrées avant stockage
- Clés de chiffrement gérées de manière sécurisée
- Calendrier de rotation des clés : Annuel

### Contrôle d'Accès

**Accès aux Sauvegardes** :
- Seul le personnel autorisé peut accéder aux sauvegardes
- Accès journalisé et audité
- Authentification multifactorielle requise
- Accès temporaire accordé pour les opérations de restauration

**Stockage des Sauvegardes** :
- Sauvegardes stockées dans un emplacement sécurisé et contrôlé
- Séparé du système principal
- Distribution géographique pour redondance
- Révisions régulières des accès

## Surveillance et Alertes

### Surveillance des Sauvegardes

**Métriques à Suivre** :
- Statut d'achèvement des sauvegardes
- Tendances de taille des sauvegardes
- Résultats des tests de restauration
- Taux d'échec des sauvegardes

**Alertes** :
- Sauvegarde échouée : Critique (Pager l'équipe d'ingénierie)
- Sauvegarde retardée : Avertissement (Surveiller)
- Test de restauration échoué : Critique (Pager l'équipe d'ingénierie)
- Capacité de stockage faible : Avertissement (Planifier l'expansion)

**Tableau de Bord** :
```yaml
# Exemple de requêtes de tableau de bord Grafana
- Temps d'achèvement de sauvegarde
- Tendances de taille de sauvegarde
- Nombre de sauvegardes disponibles
- Temps écoulé depuis la dernière sauvegarde réussie
```

## Communication

### Communication du Statut de Sauvegarde

**Interne** :
- Rapports réguliers sur le statut des sauvegardes
- Notification immédiate des échecs
- Résumé des résultats des tests de sauvegarde

**Externe** (si applicable) :
- Pratiques de gestion des données
- Périodes de rétention des sauvegardes
- Capacités de récupération des données
- Certifications de conformité

## Documentation

### Journal des Sauvegardes

Maintenir un journal de toutes les opérations de sauvegarde :
```markdown
# Journal de Sauvegarde - [Date]

## Sauvegardes Automatisées
- Base de Données : [Succès/Échec]
- Stockage de Fichiers : [Succès/Échec]
- Heure : [Horodatage]

## Sauvegardes Manuelles
- Raison : [Pourquoi sauvegarde manuelle créée]
- Type : [Base de Données/Fichiers/Complète]
- Emplacement : [Emplacement de stockage]
- Créé Par : [Nom]

## Opérations de Restauration
- Raison : [Pourquoi restauration effectuée]
- Sauvegarde Utilisée : [Quelle sauvegarde]
- Durée : [Temps de restauration]
- Résultat : [Succès/Échec]
```

### Mises à Jour du Runbook

Mettre à jour ce runbook lorsque :
- Les procédures de sauvegarde changent
- De nouveaux outils de sauvegarde sont implémentés
- Les procédures de restauration sont améliorées
- Des leçons sont tirées des incidents
- Les révisions trimestrielles sont effectuées

## Gestion des Coûts

### Coûts de Stockage des Sauvegardes

**Surveillance** :
- Suivre l'utilisation du stockage des sauvegardes
- Surveiller les tendances des coûts
- Optimiser la fréquence des sauvegardes si nécessaire
- Utiliser les niveaux de stockage appropriés

**Optimisation des Coûts** :
- Utiliser les stratégies de cycle de vie pour l'archivage
- Comprimer les sauvegardes
- Dédupliquer les données lorsque possible
- Réviser régulièrement les périodes de rétention

## Ressources

### Outils
- **Supabase CLI** : `supabase db dumps`
- **PostgreSQL** : `pg_dump`, `pg_restore`
- **Rclone** : Pour la synchronisation du stockage cloud
- **AWS S3** : Pour l'archivage à long terme

### Documentation
- **Sauvegarde Supabase** : https://supabase.com/docs/guides/platform/backups
- **Sauvegarde PostgreSQL** : https://www.postgresql.org/docs/current/backup.html
- **Reprise après Sinistre** : [incident-response.md](./incident-response.md)

## Dernière Mise à Jour

- Date : 2024-10-15
- Version : 1.0
- Dernier Test de Sauvegarde : [Date]
- Prochain Test de Sauvegarde : [Date]

## Annexes

### Annexe A : Scripts de Sauvegarde

### Annexe B : Procédures de Restauration par Composant

### Annexe C : Journal des Résultats des Tests de Sauvegarde

### Annexe D : Informations de Contact des Fournisseurs
