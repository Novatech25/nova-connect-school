# Stratégies de Sécurité au Niveau Ligne (RLS)

## Vue d'ensemble

NovaConnect utilise la Sécurité au Niveau Ligne (Row-Level Security ou RLS) de PostgreSQL pour appliquer l'isolement des données entre les écoles et le contrôle d'accès basé sur les rôles. Les stratégies RLS sont appliquées au niveau de la base de données, fournissant une couche de sécurité qui fonctionne même si les contrôles au niveau de l'application échouent.

## Architecture

### Modèle de Multi-tenance

NovaConnect utilise la multi-tenance **base de données partagée, schéma partagé** :
- Toutes les écoles partagent les mêmes tables de base de données
- Les données de chaque école sont isolées en utilisant la colonne `school_id`
- Les stratégies RLS assurent que les utilisateurs ne peuvent accéder qu'aux données de leur école

### Couches de Sécurité

1. **Couche Application** : Contrôles d'authentification dans les routes API
2. **Couche Base de Données** : Stratégies RLS (ce document)
3. **Couche Réseau** : VPC, règles pare-feu
4. **Couche Audit** : Tout accès est journalisé dans `audit_logs`

## Fonctions RLS Principales

### Fonctions d'Aide

Ces fonctions sont utilisées dans les stratégies RLS pour vérifier les permissions :

```sql
-- Obtenir l'ID école de l'utilisateur actuel
CREATE OR REPLACE FUNCTION get_current_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Vérifier si l'utilisateur est super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Vérifier si l'utilisateur a un rôle spécifique dans l'école
CREATE OR REPLACE FUNCTION has_school_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = required_role
    AND school_id = get_current_user_school_id()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Vérifier si l'utilisateur est assigné à une classe spécifique
CREATE OR REPLACE FUNCTION is_assigned_to_class(class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM teacher_assignments
    WHERE teacher_id = auth.uid()
    AND class_id = $1
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

## Stratégies Spécifiques aux Tables

### schools

```sql
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Les super admins peuvent gérer toutes les écoles
CREATE POLICY super_admin_full_access ON schools
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Les admins école peuvent gérer leur propre école
CREATE POLICY school_admin_own_school ON schools
  FOR ALL
  TO authenticated
  USING (
    id = get_current_user_school_id()
    AND has_school_role('school_admin')
  )
  WITH CHECK (
    id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );

-- Tous les utilisateurs authentifiés peuvent voir leur école
CREATE POLICY users_view_own_school ON schools
  FOR SELECT
  TO authenticated
  USING (id = get_current_user_school_id());
```

### users

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Les super admins peuvent voir tous les utilisateurs
CREATE POLICY super_admin_all_users ON users
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Les admins école peuvent voir les utilisateurs de leur école
CREATE POLICY school_admin_school_users ON users
  FOR ALL
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  )
  WITH CHECK (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );

-- Les utilisateurs peuvent voir leur propre profil
CREATE POLICY users_own_profile ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Les enseignants peuvent voir les étudiants dans leurs classes
CREATE POLICY teachers_view_class_students ON users
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT user_id FROM students
      WHERE class_id IN (
        SELECT class_id FROM teacher_assignments WHERE teacher_id = auth.uid()
      )
    )
    AND has_school_role('teacher')
  );

-- Les parents peuvent voir leurs enfants
CREATE POLICY parents_view_children_users ON users
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT user_id FROM students WHERE parent_id = auth.uid()
    )
    AND has_school_role('parent')
  );
```

### students

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Les super admins peuvent gérer tous les étudiants
CREATE POLICY super_admin_all_students ON students
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Les admins école peuvent gérer tous les étudiants de leur école
CREATE POLICY school_admin_all_students ON students
  FOR ALL
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  )
  WITH CHECK (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );

-- Les enseignants peuvent voir les étudiants dans leurs classes assignées
CREATE POLICY teachers_view_class_students ON students
  FOR SELECT
  TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM teacher_assignments WHERE teacher_id = auth.uid()
    )
    AND has_school_role('teacher')
  );

-- Les étudiants peuvent voir leur propre enregistrement
CREATE POLICY students_own_record ON students
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Les parents peuvent voir leurs enfants
CREATE POLICY parents_view_children ON students
  FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
    OR id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
  )
  AND has_school_role('parent');
```

### student_grades

```sql
ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;

-- Les super admins peuvent voir toutes les notes
CREATE POLICY super_admin_all_grades ON student_grades
  FOR ALL
  TO authenticated
  USING (is_super_admin());

-- Les admins école peuvent voir toutes les notes de leur école
CREATE POLICY school_admin_all_grades ON student_grades
  FOR ALL
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );

-- Les enseignants peuvent voir et créer des notes pour leurs classes assignées
CREATE POLICY teachers_manage_class_grades ON student_grades
  FOR ALL
  TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM teacher_assignments
      WHERE teacher_id = auth.uid()
      AND subject_id = student_grades.subject_id
    )
    AND has_school_role('teacher')
  )
  WITH CHECK (
    class_id IN (
      SELECT class_id FROM teacher_assignments
      WHERE teacher_id = auth.uid()
      AND subject_id = student_grades.subject_id
    )
    AND has_school_role('teacher')
  );

-- Les étudiants ne peuvent voir que leurs propres notes publiées
CREATE POLICY students_view_own_grades ON student_grades
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
    AND status = 'published'
  );

-- Les parents peuvent voir les notes publiées de leurs enfants
CREATE POLICY parents_view_children_grades ON student_grades
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
    AND status = 'published'
  );
```

**Important** : `status = 'published'` assure que les brouillons de notes ne sont pas visibles aux étudiants/parents.

### attendance_records

```sql
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Les admins école peuvent voir toutes les présences
CREATE POLICY school_admin_all_attendance ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );

-- Les enseignants peuvent gérer la présence pour leurs classes
CREATE POLICY teachers_manage_class_attendance ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM attendance_sessions
      WHERE class_id IN (
        SELECT class_id FROM teacher_assignments WHERE teacher_id = auth.uid()
      )
    )
    AND has_school_role('teacher')
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM attendance_sessions
      WHERE class_id IN (
        SELECT class_id FROM teacher_assignments WHERE teacher_id = auth.uid()
      )
      OR teacher_id = auth.uid()
    )
    AND has_school_role('teacher')
  );

-- Les étudiants voient leur propre présence
CREATE POLICY students_view_own_attendance ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- Les parents voient la présence de leurs enfants
CREATE POLICY parents_view_children_attendance ON attendance_records
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
  );
```

### payments

```sql
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Les admins école peuvent voir tous les paiements
CREATE POLICY school_admin_all_payments ON payments
  FOR ALL
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );

-- Les comptables peuvent gérer tous les paiements de l'école
CREATE POLICY accountant_manage_payments ON payments
  FOR ALL
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('accountant')
  )
  WITH CHECK (
    school_id = get_current_user_school_id()
    AND has_school_role('accountant')
  );

-- Les étudiants voient leurs propres paiements
CREATE POLICY students_view_own_payments ON payments
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- Les parents voient les paiements de leurs enfants
CREATE POLICY parents_view_children_payments ON payments
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id = auth.uid()
    )
  );
```

### fee_schedules

```sql
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;

-- Similaire à payments : admins école, comptables (accès complet)
-- Étudiants et parents (lecture seule de leurs propres enregistrements)
```

### audit_logs

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Les super admins peuvent voir tous les journaux
CREATE POLICY super_admin_all_logs ON audit_logs
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Les admins école peuvent voir les journaux de leur école
CREATE POLICY school_admin_school_logs ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );

-- **Important** : Aucune stratégie INSERT/UPDATE/DELETE (les journaux sont immuables)
```

## Matrice des Rôles

| Ressource | Super Admin | Admin École | Enseignant | Étudiant | Parent | Comptable |
|----------|-------------|-------------|------------|----------|--------|-----------|
| **schools** | CRUD | Lecture école propre | Lecture école propre | Lecture école propre | Lecture école propre | Lecture école propre |
| **users** | Tous | Utilisateurs école | Étudiants classe | Soi-même | Enfants | Utilisateurs école |
| **students** | Tous | Tous école | Classes assignées | Soi-même | Enfants | Tous école |
| **student_grades** | Tous | Tous école | Matières assignées | Propres (publiées) | Enfants (publiées) | Lecture seule |
| **attendance_records** | Tous | Tous école | Classes assignées | Soi-même | Enfants | Lecture seule |
| **payments** | Tous | Tous école | Lecture seule | Soi-même | Enfants | Tous école |
| **fee_schedules** | Tous | Tous école | Lecture seule | Soi-même | Enfants | Tous école |
| **audit_logs** | Tous | Journaux école | Refuser | Refuser | Refuser | Refuser |

## Meilleures Pratiques de Sécurité

### 1. N'utilisez Jamais `USING (true)`

Spécifiez toujours des conditions explicites :

```sql
-- MAUVAIS : Autorise tous les utilisateurs authentifiés
CREATE POLICY bad_policy ON students
  FOR ALL
  TO authenticated
  USING (true);

-- BON : Conditions explicites
CREATE POLICY good_policy ON students
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_current_user_school_id()
    AND has_school_role('school_admin')
  );
```

### 2. Utilisez SECURITY DEFINER pour les Fonctions d'Aide

Prévenez l'escalade de privilèges :

```sql
CREATE OR REPLACE FUNCTION get_current_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER; -- Important !
```

### 3. Appliquez les Stratégies à la fois SELECT et INSERT/UPDATE

```sql
CREATE POLICY teacher_manage_grades ON student_grades
  FOR ALL -- S'applique à SELECT, INSERT, UPDATE, DELETE
  TO authenticated
  USING (class_id IN (...))
  WITH CHECK (class_id IN (...)); -- Vérifie aussi sur INSERT/UPDATE
```

### 4. Testez les Stratégies avec Différents Rôles

```sql
-- Tester en tant que super admin
SET LOCAL request.jwt.claim.sub = 'super_admin_user_id';
SELECT * FROM students; -- Devrait retourner tous

-- Tester en tant qu'admin école
SET LOCAL request.jwt.claim.sub = 'school_admin_user_id';
SELECT * FROM students; -- Devrait retourner seulement les étudiants de l'école

-- Tester en tant qu'étudiant
SET LOCAL request.jwt.claim.sub = 'student_user_id';
SELECT * FROM students; -- Devrait retourner seulement soi-même
```

### 5. Journalisez les Violations de Stratégies

```sql
-- Ajouter la journalisation pour détecter les tentatives de contournement RLS
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  attempted_action TEXT,
  table_name TEXT,
  policy_name TEXT,
  details JSONB
);
```

## Tester les Stratégies RLS

### Tests Manuels

```sql
-- Activer RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Test 1 : Vérifier l'isolement des écoles
BEGIN;
  SET LOCAL request.jwt.claim.sub = 'school_a_admin_id';
  SELECT COUNT(*) FROM students; -- Devrait être seulement le compte de l'école A
COMMIT;

BEGIN;
  SET LOCAL request.jwt.claim.sub = 'school_b_admin_id';
  SELECT COUNT(*) FROM students; -- Devrait être seulement le compte de l'école B
COMMIT;

-- Test 2 : Vérifier l'accès basé sur les rôles
BEGIN;
  SET LOCAL request.jwt.claim.sub = 'teacher_user_id';
  SELECT * FROM student_grades WHERE status = 'draft'; -- Devrait réussir pour ses propres classes
  SELECT * FROM student_grades WHERE class_id != 'assigned_class'; -- Devrait échouer
COMMIT;
```

### Tests Automatisés

Voir `docs/security/rls-checklist.md` pour les procédures de test complètes.

## Problèmes Courants et Solutions

### Problème : Stratégies Non Fonctionnelles

**Symptômes** : Les utilisateurs peuvent voir des données qu'ils ne devraient pas

**Solutions** :
1. Vérifiez que RLS est activé : `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Vérifiez les définitions de stratégies
3. Vérifiez que les fonctions d'aide existent et fonctionnent correctement
4. Testez avec des ID utilisateurs réels

### Problème : Dégradation des Performances

**Symptômes** : Requêtes lentes après l'activation de RLS

**Solutions** :
1. Ajoutez des index sur les colonnes filtrées (`school_id`, `class_id`, etc.)
2. Optimisez les conditions de stratégie
3. Utilisez efficacement les clauses `USING`
4. Envisagez des vues matérialisées pour les requêtes complexes

### Problème : Trop de Stratégies

**Symptômes** : Difficile à gérer, problèmes de performance

**Solutions** :
1. Combinez les stratégies liées
2. Utilisez des fonctions d'aide
3. Exploitez la hiérarchie des rôles
4. Audits réguliers des stratégies

## Surveillance et Audit

### Surveillance des Performances des Stratégies

```sql
-- Vérifier quelles stratégies sont le plus utilisées
SELECT
  schemaname,
  tablename,
  policyname,
  calls,
  total_time,
  mean_time
FROM pg_stat_policies
ORDER BY total_time DESC;
```

### Analyse des Modèles d'Accès

```sql
-- Surveiller les modèles d'accès par rôle
SELECT
  ur.role,
  al.action,
  al.resource_type,
  COUNT(*) as access_count
FROM audit_logs al
JOIN user_roles ur ON al.user_id = ur.user_id
WHERE al.timestamp >= NOW() - INTERVAL '7 days'
GROUP BY ur.role, al.action, al.resource_type
ORDER BY access_count DESC;
```

## Ressources

- **Liste de Vérification RLS** : [docs/security/rls-checklist.md](../security/rls-checklist.md)
- **RLS PostgreSQL** : https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **RLS Supabase** : https://supabase.com/docs/guides/auth/row-level-security
- **Contrôle d'Accès OWASP** : https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html
