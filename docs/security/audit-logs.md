# Journaux d'Audit

## Vue d'Ensemble

NovaConnect maintient des journaux d'audit complets pour suivre toutes les activités système, assurant la responsabilité, la conformité sécurité et la capacité d'enquêter sur les problèmes.

## Ce Qui Est Journalisé

### Authentification Utilisateur
- Tentatives de connexion (réussies et échouées)
- Événements de déconnexion
- Changements de mot de passe
- Demandes de réinitialisation mot de passe
- Verrouillages de compte
- Défis MFA

### Accès aux Données
- Vues d'enregistrements (élèves, notes, paiements, etc.)
- Exécutions de requêtes
- Génération de rapports
- Exportations de données
- Accès données sensibles (ex: visualisation tous élèves)

### Modifications de Données
- Opérations de création (INSERT)
- Opérations de mise à jour (UPDATE)
- Opérations de suppression (DELETE)
- Opérations en masse
- Opérations d'import/export

### Actions Administratives
- Gestion des utilisateurs (créer, mettre à jour, supprimer, changements de rôle)
- Changements de permissions
- Mises à jour configuration système
- Publication des notes
- Approbations des présences
- Traitement des paiements

### Événements Système
- Exécution des tâches planifiées
- Opérations de sauvegarde
- Erreurs et exceptions système
- Appels API
- Activités d'intégration
- Traitement des tâches en arrière-plan

## Structure des Journaux d'Audit

Chaque entrée de journal d'audit contient :

```typescript
{
  id: string;                    // Identifiant unique
  timestamp: datetime;            // Quand action s'est produite
  user_id: string;               // Qui a effectué l'action (null pour système)
  user_role: string;             // Rôle de l'utilisateur (teacher, admin, etc.)
  action: string;                // Action effectuée (create, read, update, delete)
  resource_type: string;         // Type de ressource (student, grade, payment)
  resource_id: string;           // ID de la ressource affectée
  school_id: string;             // Contexte de l'école
  ip_address: string;            // Adresse IP de la requête
  user_agent: string;            // Info navigateur/client
  status: string;                // success, failure, partial
  details: jsonb;                // Contexte additionnel
  changed_fields?: string[];     // Liste des champs modifiés
  old_values?: jsonb;            // Valeurs avant changement
  new_values?: jsonb;            // Valeurs après changement
}
```

## Visualisation des Journaux d'Audit

### Via Portail Admin

1. Naviguer vers **Paramètres > Journaux Système**
2. Filtrer par :
   - Plage de dates
   - Utilisateur
   - Type d'action
   - Type de ressource
   - Statut
3. Voir les entrées de journal détaillées
4. Exporter vers CSV/Excel pour analyse

### Via Base de Données (Accès Direct)

```sql
-- Voir les journaux récents
SELECT * FROM audit_logs
ORDER BY timestamp DESC
LIMIT 100;

-- Voir les journaux pour un utilisateur spécifique
SELECT * FROM audit_logs
WHERE user_id = 'user-123'
ORDER BY timestamp DESC;

-- Voir toutes tentatives de connexion échouées
SELECT * FROM audit_logs
WHERE action = 'login'
  AND status = 'failure'
ORDER BY timestamp DESC;

-- Voir les changements de notes
SELECT * FROM audit_logs
WHERE resource_type = 'grade'
  AND action IN ('update', 'delete')
ORDER BY timestamp DESC;

-- Voir les exportations de données sensibles
SELECT * FROM audit_logs
WHERE action = 'export'
  AND resource_type IN ('students', 'grades', 'payments')
ORDER BY timestamp DESC;
```

## Requêtes et Rapports de Journaux d'Audit

### Requêtes Courantes

#### Résumé Activité Utilisateur
```sql
SELECT
  user_id,
  user_role,
  COUNT(*) as action_count,
  MIN(timestamp) as first_action,
  MAX(timestamp) as last_action
FROM audit_logs
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY user_id, user_role
ORDER BY action_count DESC;
```

#### Tentatives de Connexion Échouées
```sql
SELECT
  user_id,
  ip_address,
  COUNT(*) as failed_attempts,
  MAX(timestamp) as last_attempt
FROM audit_logs
WHERE action = 'login'
  AND status = 'failure'
  AND timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY user_id, ip_address
HAVING COUNT(*) >= 5
ORDER BY failed_attempts DESC;
```

#### Modification de Données par Rôle
```sql
SELECT
  user_role,
  action,
  resource_type,
  COUNT(*) as count
FROM audit_logs
WHERE action IN ('create', 'update', 'delete')
  AND timestamp >= NOW() - INTERVAL '30 days'
GROUP BY user_role, action, resource_type
ORDER BY count DESC;
```

#### Historique Publication des Notes
```sql
SELECT
  al.user_id,
  u.first_name,
  u.last_name,
  al.timestamp,
  al.details->>'class_id' as class_id,
  al.details->>'term' as term,
  al.details->>'grade_count' as grade_count
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.action = 'publish_grades'
ORDER BY al.timestamp DESC;
```

#### Journal Traitement des Paiements
```sql
SELECT
  al.timestamp,
  al.resource_id as payment_id,
  al.user_id as processed_by,
  al.new_values->>'amount' as amount,
  al.new_values->>'status' as status,
  al.status as operation_status
FROM audit_logs al
WHERE al.resource_type = 'payment'
  AND al.action = 'create'
ORDER BY al.timestamp DESC;
```

## Surveillance Sécurité

### Déclencheurs d'Alertes

Configurer des alertes automatisées pour :

#### Activité de Connexion Suspecte
- Plus de 5 tentatives de connexion échouées depuis même IP
- Connexion depuis emplacement géographique inhabituel
- Connexion à heure inhabituelle (ex: 2h du matin)
- Connexion réussie après échecs multiples

#### Exfiltration de Données
- Exportations de données volumineuses (>1000 enregistrements)
- Exportations multiples dans courte période
- Exportation par utilisateur sans motif d'exportation normal

#### Tentatives d'Accès Non Autorisé
- Accès ressources hors école de l'utilisateur
- Erreurs refus permission en augmentation
- Tentatives d'accès données restreintes

#### Falsification de Données
- Mises à jour multiples de notes dans courte période
- Modification note après publication
- Changements montant paiement
- Suppression enregistrements critiques

### Tableau de Bord Surveillance

Créer un tableau de bord de surveillance montrant :
- Tentatives de connexion échouées (dernières 24h)
- Sessions utilisateurs actives
- Tentatives de permission échouées récentes
- Activité d'exportation de données
- Erreurs et exceptions système
- Temps de réponse API

## Conformité et Rétention

### Politique de Rétention des Données

| Type de Journal | Période de Rétention | Raison |
|----------------|---------------------|--------|
| Journaux authentification | 2 ans | Enquêtes sécurité |
| Journaux accès données | 1 an | Analyse motifs accès |
| Journaux modification données | 7 ans | Conformité académique et financière |
| Actions administratives | 5 ans | Responsabilité et audit |
| Événements système | 6 mois | Surveillance performance |
| Opérations échouées | 2 ans | Enquête sécurité |

### Exigences de Conformité

#### GDPR (Europe)
- Droit d'accès : Utilisateurs peuvent demander leurs journaux d'audit
- Droit à l'effacement : Anonymiser journaux après demande suppression données
- Portabilité données : Exporter journaux au format lisible par machine
- Notification violation : Alerte dans les 72 heures de violation de données

#### FERPA (USA - Éducation)
- Journaliser tout accès aux dossiers éducatifs étudiants
- Conserver journaux minimum 5 ans
- Restreindre accès journaux au personnel autorisé
- Inclure finalité accès dans détails journal

#### Normes Industrie
- ISO 27001 : Journalisation et surveillance complètes
- SOC 2 : Trace d'audit pour tout accès système
- PCI DSS : Journaux d'audit traitement paiements

## Analyse des Journaux

### Outils et Techniques

#### Requêtes SQL
- Utiliser requêtes base de données pour analyse ad hoc
- Créer vues réutilisables pour rapports courants
- Planifier rapports automatisés

#### Agrégation des Journaux
- Centraliser journaux de tous environnements (dev, staging, production)
- Utiliser outils agrégation journaux (ELK Stack, Splunk, Datadog)
- Configurer tableaux de bord pour surveillance temps réel

#### Détection Anomalies
- Modèles machine learning pour détecter motifs inhabituels
- Analyse statistique pour détection valeurs aberrantes
- Analyse séries temporelles pour identification tendances

### Métriques Clés à Suivre

- **Activité Utilisateur** : Utilisateurs actifs quotidiens, pics d'utilisation
- **Événements Sécurité** : Connexions échouées, refus permissions
- **Qualité Données** : Validations échouées, taux d'erreurs
- **Performance** : Requêtes lentes, opérations longues
- **Conformité** : Violations politiques, changements non approuvés

## Sécurité des Journaux d'Audit

### Protection des Journaux d'Audit

1. **Journaux Immuable** : Empê modification/suppression des journaux
   ```sql
   -- Utiliser déclencheurs base de données ou politiques RLS
   CREATE POLICY audit_logs_immutable
   ON audit_logs
   FOR ALL
   TO authenticated_user
   USING (false); -- Pas de mises à jour/suppressions directes
   ```

2. **Contrôle d'Accès** : Restreindre accès journaux au personnel autorisé
   - Seuls super admins et admins école peuvent voir journaux
   - Implémenter accès basé sur rôles à différents types journaux
   - Journaliser tout accès aux journaux d'audit eux-mêmes

3. **Vérification Intégrité** : Vérifier régulièrement intégrité journaux
   - Vérifier les lacunes dans séquence journaux
   - Vérifier sommes de contrôle
   - Surveiller modifications non autorisées

4. **Stockage Sécurisé** : Chiffrer journaux au repos
   - Chiffrement base de données
   - Stockage séparé des données application
   - Sauvegardes régulières vers emplacement sécurisé

5. **Rotation Journaux** : Gérer tailles fichiers journaux
   - Archiver vieux journaux vers stockage froid
   - Comprimer journaux historiques
   - Maintenir index pour interrogation efficace

## Procédures d'Enquête

### Quand Enquêter

- Violation de données suspectée
- Utilisateur signale activité non autorisée
- Problèmes de performance système
- Demandes audit conformité
- Procédures juridiques

### Étapes d'Enquête

1. **Identifier Périmètre**
   - Qu'est-ce qui s'est passé ?
   - Quand cela s'est-il produit ?
   - Qui a été affecté ?
   - Quelles données étaient impliquées ?

2. **Rassembler Preuves**
   - Interroger journaux d'audit pour période pertinente
   - Exporter entrées journal pour analyse
   - Corréler avec autres sources (journaux app, journaux base de données)
   - Préserver preuves dans emplacement sécurisé

3. **Analyser Motifs**
   - Identifier utilisateur(s) impliqué(s)
   - Chronologie des événements
   - Actions effectuées
   - Données accédées/modifiées

4. **Déterminer Impact**
   - Portée données affectées
   - Implications sécurité potentielles
   - Violations conformité
   - Impact commercial

5. **Documenter Conclusions**
   - Créer rapport enquête
   - Inclure preuves et chronologie
   - Recommander actions correctives
   - Partager avec parties prenantes au besoin

### Modèle d'Enquête

```markdown
# Rapport Enquête Audit

## Résumé Incident
- Date/Heure : [quand incident s'est produit]
- Signalé Par : [qui a signalé]
- Type Incident : [sécurité, conformité, performance]
- Gravité : [faible, moyen, élevé, critique]

## Chronologie
| Heure | Événement | Utilisateur | Détails |
|------|-----------|------------|---------|

## Ressources Affectées
- Type Ressource : [students, grades, payments]
- Enregistrements Affectés : [nombre]
- Sensibilité Données : [faible, moyen, élevé]

## Actions Prises
1. [Actions immédiates prises]
2. [Actions en cours]
3. [Actions recommandées]

## Analyse Cause Racine
[Analyse pourquoi incident s'est produit]

## Recommandations
1. [Mesures préventives]
2. [Mesures détection]
3. [Mesures correctives]

## Preuves
- [Exports journaux attachés]
- [Captures d'écran]
- [Documents support]
```

## Meilleures Pratiques

### Pour Admins
- Réviser journaux d'audit hebdomadairement
- Enquêter activité suspecte rapidement
- Maintenir calendrier rétention journaux
- Tester régulièrement sauvegarde/restauration journaux
- Documenter procédures enquête

### Pour Développeurs
- Journaliser toutes opérations sensibles
- Inclure détails suffisants pour enquête
- Utiliser format journal structuré (JSON)
- Éviter de journaliser données sensibles (mots de passe, jetons)
- Tester régulièrement requêtes journaux

### Pour Sécurité
- Surveiller journaux en temps réel lorsque possible
- Configurer alertes automatisées pour événements critiques
- Audit régulier accès journaux
- Audit sécurité périodique système journalisation
- Assurer journaux survivent pannes système

## Dépannage

### Journaux Manquants

**Symptôme** : Entrées journal attendues non trouvées

**Causes Possibles** :
- Journalisation non activée pour cette opération
- Période rétention journal expirée
- Erreur requête base de données
- Dysfonctionnement système pendant journalisation

**Solutions** :
- Vérifier configuration journalisation
- Vérifier base de données pour erreurs techniques
- Réviser journaux application pour erreurs
- Restaurer depuis sauvegarde si critique

### Impact Performance

**Symptôme** : Système lent dû à journalisation

**Solutions** :
- Archiver vieux journaux vers stockage séparé
- Créer index sur colonnes fréquemment interrogées
- Utiliser partitionnement pour grandes tables journaux
- Implémenter journalisation asynchrone
- Considérer échantillonnage pour opérations grand volume

### Performance Requêtes

**Symptôme** : Requêtes journaux d'audit lentes

**Solutions** :
- Ajouter index sur `timestamp`, `user_id`, `action`, `resource_type`
- Limiter plage dates dans requêtes
- Utiliser pagination pour grands ensembles résultats
- Créer vues matérialisées pour rapports courants
- Considérer répliques lecture pour interrogation

## Ressources

- **Documentation Connexe** :
  - [Vue d'Ensemble Sécurité](security-overview.md)
  - [Politiques RLS](rls-checklist.md)
  - [Runbooks](../runbooks/)

- **Schéma Base de Données** : Voir `supabase/migrations/` pour définition table audit_log

- **Référence API** : Endpoints journaux d'audit dans documentation API
