# Checklist Audit Log

## Objectif

Garantir que toutes les actions critiques sont tracées dans les logs d'audit pour conformité et sécurité.

## ✔ Triggers Automatiques

### Tables avec Audit Trigger

- [ ] **schools** - Trigger `school_audit_trigger`
  - [ ] Logs INSERT (création école)
  - [ ] Logs UPDATE (modification école)
  - [ ] Logs DELETE (désactivation école)
  - [ ] Contient: user_id, school_id, old_data, new_data

- [ ] **users** - Trigger `user_audit_trigger`
  - [ ] Logs INSERT (création utilisateur)
  - [ ] Logs UPDATE (modification profil, rôle)
  - [ ] Logs DELETE (désactivation utilisateur)
  - [ ] **Critique**: Changements de rôle loggués

- [ ] **grades** - Trigger `grade_audit_trigger`
  - [ ] Logs INSERT (création note)
  - [ ] Logs UPDATE (modification note)
  - [ ] Contient: version, old_score, new_score

- [ ] **payments** - Trigger `payment_audit_trigger`
  - [ ] Logs INSERT (enregistrement paiement)
  - [ ] Logs UPDATE (modification paiement)
  - [ ] **Critique**: Montants loggués

- [ ] **attendance_sessions** - Trigger `attendance_session_audit_trigger`
  - [ ] Logs INSERT (création session)
  - [ ] Logs UPDATE (soumission, validation)
  - [ ] Contient: status transitions

- [ ] **attendance_records** - Trigger `attendance_record_audit_trigger`
  - [ ] Logs INSERT (marquage présence)
  - [ ] Logs UPDATE (modification présence)

- [ ] **report_cards** - Trigger `report_card_audit_trigger`
  - [ ] Logs INSERT (génération bulletin)
  - [ ] Logs UPDATE (modification bulletin)

- [ ] **audit_logs** - **Pas de trigger** (table audité uniquement par fonctions)

## ✔ Fonctions Manuelles

- [ ] `log_login()` - Appelée à chaque connexion
  - [ ] Logs: user_id, school_id, ip_address, user_agent
  - [ ] Trigger: Supabase Auth hook

- [ ] `log_logout()` - Appelée à chaque déconnexion
  - [ ] Logs: user_id, school_id, session_duration

- [ ] `log_export()` - Appelée pour chaque export de données
  - [ ] Logs: resource_type, resource_ids[], export_format, file_url
  - [ ] **RGPD**: Export de données personnelles tracé

- [ ] `log_validation()` - Appelée pour chaque validation
  - [ ] Logs: resource_type (grade, lesson_log), resource_id
  - [ ] Contient: validator_id, validation_timestamp

- [ ] `log_publication()` - Appelée pour chaque publication
  - [ ] Logs: resource_type, resource_ids[], publisher_id
  - [ ] **Important**: Publication notes/EDT tracée

- [ ] `log_access_override()` - Appelée pour chaque override blocage
  - [ ] Logs: student_id, document_type, justification
  - [ ] **Sécurité**: Override document tracé

- [ ] `log_license_action()` - Appelée pour chaque action licence
  - [ ] Logs: action (activate, revoke, check), license_key, school_id
  - [ ] **Anti-copie**: Toutes actions licence tracées

## ✔ Contenu des Logs

### Champs Requis (tous logs)

- [ ] `id` - UUID unique
- [ ] `user_id` - UUID utilisateur (auth.uid())
- [ ] `school_id` - UUID école (si applicable)
- [ ] `action` - Type d'action (insert, update, delete, login, etc.)
- [ ] `resource_type` - Type de ressource (school, user, grade, etc.)
- [ ] `resource_id` - UUID de la ressource
- [ ] `ip_address` - IP de la requête
- [ ] `user_agent` - User agent du navigateur
- [ ] `timestamp` - Timestamp de l'action (UTC)

### Champs Optionnels

- [ ] `old_data` - Données avant modification (JSON)
- [ ] `new_data` - Données après modification (JSON)
- [ ] `changes` - Diff only (JSON) pour économiser espace

## ✔ Tests

### Triggers

- [ ] Test trigger INSERT sur `schools`
  - [ ] Créer une école
  - [ ] Vérifier log créé dans `audit_logs`
  - [ ] Vérifier champs: action=insert, old_data=null, new_data={...}

- [ ] Test trigger UPDATE sur `schools`
  - [ ] Modifier une école
  - [ ] Vérifier log créé
  - [ ] Vérifier champs: action=update, old_data={...}, new_data={...}

- [ ] Test trigger DELETE sur `schools`
  - [ ] Supprimer une école
  - [ ] Vérifier log créé
  - [ ] Vérifier champs: action=delete, new_data=null

### Fonctions Manuelles

- [ ] Test `log_login()`
  - [ ] Se connecter
  - [ ] Vérifier log avec action=login

- [ ] Test `log_export()`
  - [ ] Exporter une liste d'étudiants
  - [ ] Vérifier log avec action=export, resource_ids=[...], format=csv

- [ ] Test `log_access_override()`
  - [ ] Override un blocage document
  - [ ] Vérifier log avec action=access_override, justification={...}

## ✔ Conservation

- [ ] Logs **jamais supprimés** (rétention infinie)
- [ ] Archivage annuel vers stockage froid (S3 Glacier)
- [ ] Backup inclus dans backup Supabase quotidien
- [ ] Export logs disponible pour conformité RGPD

## ✔ Accessibilité

- [ ] Interface admin pour consulter logs
  - [ ] Filtrer par user_id
  - [ ] Filtrer par school_id
  - [ ] Filtrer par action
  - [ ] Filtrer par resource_type
  - [ ] Filtrer par date range

- [ ] Export logs possible
  - [ ] Format JSON
  - [ ] Format CSV
  - [ ] Format PDF pour audits

## ✔ Alertes

- [ ] Alerte sur actions sensibles
  - [ ] Suppression école → Email super admin
  - [ ] Modification role utilisateur → Email admin école
  - [ ] Override blocage document → Email admin école
  - [ ] Nombreux échecs login → Email security team

- [ ] Alerte sur anomalies
  - [ ] Volume anormal d'actions → Slack security
  - [ ] Actions hors heures ouvrables → Email admin
  - [ ] Actions depuis IP inhabituelle → Email utilisateur

## ✔ Conformité

### RGPD

- [ ] Droit d'accès: Utilisateur peut exporter ses logs
- [ ] Droit à l'effacement: Logs conservés (obligation légale)
- [ ] Portabilité: Export JSON/CSV disponible
- [ ] Traçabilité: Toutes actions personnelles logguées

### Audits Externes

- [ ] Logs complets pour audits comptables
- [ ] Logs disponibles pour audits sécurité
- [ ] Export certificable pour conformité
- [ ] Preuve d'intégrité (hash sha256 sur chaque log)

## Outils

### Requêtes Utiles

```sql
-- Voir toutes actions d'un utilisateur
SELECT * FROM audit_logs
WHERE user_id = 'user-uuid'
ORDER BY timestamp DESC;

-- Voir toutes actions sur une ressource
SELECT * FROM audit_logs
WHERE resource_type = 'grade'
AND resource_id = 'grade-uuid'
ORDER BY timestamp ASC;

-- Voir logs d'une école
SELECT * FROM audit_logs
WHERE school_id = 'school-uuid'
AND timestamp >= NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;

-- Voir actions sensibles
SELECT * FROM audit_logs
WHERE action IN ('delete', 'access_override', 'license_revoke')
ORDER BY timestamp DESC;
```

### Supabase Functions

```bash
# Vérifier trigger activé
supabase db inspect --triggers schools

# Voir logs récents
supabase db execute "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100"
```

## Validation Finale

- [ ] Tous les points de cette checklist sont validés
- [ ] Triggers testés sur toutes les tables sensibles
- [ ] Fonctions manuelles appelées aux bons endroits
- [ ] Interface admin fonctionnelle
- [ ] Alertes configurées
- [ ] Exports fonctionnels
- [ ] Documentation à jour

## Ressources

- [Supabase Audit Logging](https://supabase.com/docs/guides/database/logging)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [RGPD Article 30 - Records of processing activities](https://gdpr.eu/article-30-records-of-processing-activities/)
