# Guide des Migrations de Base de Données

## Vue d'ensemble

NovaConnect utilise les migrations Supabase pour les changements de schéma de base de données contrôlés en version. Toutes les migrations sont stockées dans `supabase/migrations/` et appliquées via le CLI Supabase.

## Workflow de Migration

### Créer une Migration

```bash
# Créer un nouveau fichier de migration
supabase migration new add_user_preferences_table

# Cela crée : supabase/migrations/TIMESTAMP_add_user_preferences_table.sql
```

### Structure de Fichier de Migration

```sql
-- Migration : add_user_preferences_table
-- Créée : 2024-10-15 10:30:00
-- Description : Ajouter la table des préférences utilisateur pour les paramètres de notification

-- Migration Up (appliquée lors de la montée)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Migration Down (appliquée lors du retour en arrière)
-- Pour annuler : DROP TABLE user_preferences;
```

### Appliquer les Migrations

```bash
# Appliquer toutes les migrations en attente à la base de données locale
supabase db reset

# Appliquer les migrations à la base de données distante (développement/staging/production)
supabase db push

# Appliquer un fichier de migration spécifique
supabase migration up --file TIMESTAMP_add_user_preferences_table.sql
```

### Annuler les Migrations

```bash
# Annuler la dernière migration
supabase migration down

# Annuler une migration spécifique
supabase migration down --file TIMESTAMP_add_user_preferences_table.sql

# Réinitialiser la base de données (toutes les migrations)
supabase db reset --debug
```

## Meilleures Pratiques de Migration

### 1. Migrations Idempotentes

Rendez les migrations sûres à exécuter plusieurs fois :

```sql
-- Mauvais (échouera si exécuté deux fois)
CREATE TABLE user_preferences (...);

-- Bon (vérifie l'existence)
CREATE TABLE IF NOT EXISTS user_preferences (...);

-- Mieux (vérification explicite)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_preferences'
  ) THEN
    CREATE TABLE user_preferences (...);
  END IF;
END $$;
```

### 2. Migrations Réversibles

Considérez toujours l'annulation :

```sql
-- Ajouter une colonne (up)
ALTER TABLE users ADD COLUMN phone VARCHAR(50);

-- La migration down serait :
-- ALTER TABLE users DROP COLUMN phone;

-- Mieux : Utiliser des transactions et une migration down explicite
BEGIN;
  -- Ajouter une colonne avec une valeur par défaut si nécessaire
  ALTER TABLE users ADD COLUMN phone VARCHAR(50);
  CREATE INDEX idx_users_phone ON users(phone);
COMMIT;

-- Down :
BEGIN;
  DROP INDEX idx_users_phone;
  ALTER TABLE users DROP COLUMN phone;
COMMIT;
```

### 3. Changements Non-Breaking

Déployez des changements sans temps d'arrêt :

```sql
-- Au lieu de renommer une colonne (brise le code existant)
ALTER TABLE students RENAME COLUMN matricule TO student_id;

-- Utilisez cette approche :
-- Étape 1 : Ajouter la nouvelle colonne
ALTER TABLE students ADD COLUMN student_id VARCHAR(50);

-- Étape 2 : Déployer le code qui écrit dans les deux colonnes
-- (Mettre à jour le code d'application)

-- Étape 3 : Remplir les données rétroactivement
UPDATE students SET student_id = matricule WHERE student_id IS NULL;

-- Étape 4 : Déployer le code qui lit depuis la nouvelle colonne
-- (Mettre à jour le code d'application à nouveau)

-- Étape 5 : Supprimer l'ancienne colonne
ALTER TABLE students DROP COLUMN matricule;
```

### 4. Migrations de Données

Séparez les changements de schéma des migrations de données :

```sql
-- Migration de schéma (rapide)
ALTER TABLE payments ADD COLUMN status VARCHAR(50) DEFAULT 'pending';

-- Migration de données (potentiellement lente, exécuter séparément)
-- Dans un fichier de migration séparé ou un travail d'arrière-plan
UPDATE payments
SET status = CASE
  WHEN verified_at IS NOT NULL THEN 'verified'
  WHEN rejected_at IS NOT NULL THEN 'rejected'
  ELSE 'pending'
END;
```

## Modèles de Migration Courants

### Ajouter une Nouvelle Table

```sql
-- Migration : add_announcements_table
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_audience VARCHAR(50) NOT NULL, -- 'all', 'students', 'teachers', 'parents'
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_school_id ON announcements(school_id);
CREATE INDEX idx_announcements_published_at ON announcements(published_at DESC);
CREATE INDEX idx_announcements_target_audience ON announcements(target_audience);

-- Activer la Sécurité au Niveau Ligne
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Stratégie : Les admins école peuvent gérer les annonces
CREATE POLICY school_admin_manage_announcements ON announcements
  FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'school_admin'
    )
  );

-- Stratégie : Les utilisateurs peuvent voir les annonces de leur école
CREATE POLICY users_view_announcements ON announcements
  FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
```

### Ajouter une Colonne

```sql
-- Migration : add_last_login_to_users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);
```

### Renommer une Table

```sql
-- Migration : rename_student_grades_to_grades
-- Note : C'est breaking, envisagez des alternatives d'abord

ALTER TABLE student_grades RENAME TO grades;

-- Mettre à jour toutes les références de clés étrangères
ALTER INDEX student_grades_student_id_idx RENAME TO grades_student_id_idx;
-- ... (mettre à jour tous les autres index, contraintes, stratégies)
```

### Changer le Type de Données

```sql
-- Migration : change_phone_to_varchar_50
ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(50);

-- Si la conversion pourrait échouer, utiliser la clause USING
ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(50) USING phone::VARCHAR(50);
```

### Ajouter des Index

```sql
-- Migration : add_performance_indexes
-- Pour les colonnes fréquemment interrogées
CREATE INDEX CONCURRENTLY idx_students_status_grade
  ON students(status, grade_id)
  WHERE status = 'active';

-- Index composite pour des requêtes spécifiques
CREATE INDEX CONCURRENTLY idx_student_grades_student_subject_year
  ON student_grades(student_id, subject_id, academic_year_id);

-- Index partiel pour les requêtes filtrées
CREATE INDEX CONCURRENTLY idx_payments_verified
  ON payments(payment_date DESC)
  WHERE status = 'verified';
```

Note : `CONCURRENTLY` permet la création d'index sans verrouiller les tables.

### Ajouter des Clés Étrangères

```sql
-- Migration : add_class_foreign_key_to_students
ALTER TABLE students
  ADD CONSTRAINT FK_students_class
  FOREIGN KEY (class_id)
  REFERENCES classes(id)
  ON DELETE SET NULL;

-- Avec cascade delete
ALTER TABLE attendance_records
  ADD CONSTRAINT FK_attendance_records_student
  FOREIGN KEY (student_id)
  REFERENCES students(id)
  ON DELETE CASCADE;
```

### Ajouter des Stratégies RLS

```sql
-- Migration : add_student_rls_policies
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Stratégie : Les admins école peuvent CRUD tous les étudiants de leur école
CREATE POLICY school_admin_full_access ON students
  FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1)
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('school_admin', 'super_admin')
    )
  );

-- Stratégie : Les enseignants peuvent voir les étudiants dans leurs classes assignées
CREATE POLICY teacher_view_students ON students
  FOR SELECT
  TO authenticated
  USING (
    class_id IN (
      SELECT class_id FROM teacher_assignments WHERE teacher_id = auth.uid()
    )
  );

-- Stratégie : Les étudiants ne peuvent voir que leur propre enregistrement
CREATE POLICY student_view_own ON students
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Stratégie : Les parents peuvent voir leurs enfants
CREATE POLICY parent_view_children ON students
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT student_id FROM students WHERE parent_id = auth.uid()
    )
  );
```

## Scripts de Migration de Données

Pour les migrations de données complexes, utilisez des fonctions SQL ou des travaux d'arrière-plan :

```sql
-- Migration : backfill_student_user_ids

-- Créer une fonction pour gérer le remplissage rétroactif par lots
CREATE OR REPLACE FUNCTION backfill_student_user_ids()
RETURNS void AS $$
DECLARE
  batch_count INTEGER := 0;
BEGIN
  -- Traiter par lots de 1000
  FOR batch IN
    SELECT id FROM students WHERE user_id IS NULL LIMIT 1000
  LOOP
    -- Créer un compte utilisateur pour l'étudiant
    INSERT INTO users (email, password_hash, first_name, last_name, role, school_id)
    VALUES (
      'student_' || batch.id || '@temp.com',
      crypt('temp_password', gen_salt('bf')),
      (SELECT first_name FROM students WHERE id = batch.id),
      (SELECT last_name FROM students WHERE id = batch.id),
      'student',
      (SELECT school_id FROM students WHERE id = batch.id)
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO batch.user_id;

    batch_count := batch_count + 1;

    IF batch_count % 100 = 0 THEN
      COMMIT;
      RAISE NOTICE 'Traité % enregistrements', batch_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Remplissage rétroactif terminé. Total enregistrements : %', batch_count;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la fonction
SELECT backfill_student_user_ids();

-- Nettoyer la fonction
DROP FUNCTION backfill_student_user_ids();
```

## Tester les Migrations

### Tests Locaux

```bash
# Réinitialiser la base de données locale et appliquer toutes les migrations
supabase db reset

# Vérifier le schéma
supabase db inspect --schema public

# Vérifier les stratégies RLS
supabase db inspect --policies students
```

### Tests de Staging

```bash
# Lier à l'environnement de staging
supabase link --project-ref $SUPABASE_STAGING_PROJECT_ID

# Prévisualiser les changements de migration
supabase db push --dry-run

# Appliquer à staging
supabase db push

# Exécuter les tests contre staging
pnpm test:e2e --env staging
```

### Liste de Vérification de Validation de Migration

- [ ] La migration s'exécute sans erreurs
- [ ] La migration peut être annulée
- [ ] L'intégrité des données est maintenue
- [ ] Les stratégies RLS fonctionnent toujours
- [ ] L'application fonctionne correctement
- [ ] Les tests de performance réussissent
- [ ] Aucune perte de données
- [ ] Le code est mis à jour pour les changements de schéma

## Workflow de Déploiement

### Pré-Déploiement

1. **Créer une migration** :
   ```bash
   supabase migration new nom_descriptif
   ```

2. **Écrire le SQL de migration** :
   - Éditer le fichier de migration généré
   - Inclure les migrations up et down
   - Tester localement

3. **Tester localement** :
   ```bash
   supabase db reset
   pnpm test
   ```

4. **Revue de code** :
   - Revoir le SQL de migration
   - Vérifier les stratégies RLS
   - Vérifier les risques de perte de données

### Déploiement

1. **Sauvegarder la base de données de production** (automatisé)
   ```bash
   # Sauvegarde manuelle si nécessaire
   supabase db dump --db-url="$DATABASE_URL" > backup_$(date +%Y%m%d).sql
   ```

2. **Appliquer la migration à staging** :
   ```bash
   supabase link --project-ref $SUPABASE_STAGING_PROJECT_ID
   supabase db push
   ```

3. **Tester staging** :
   ```bash
   pnpm test:e2e --env staging
   ```

4. **Appliquer la migration à production** :
   ```bash
   supabase link --project-ref $SUPABASE_PRODUCTION_PROJECT_ID
   supabase db push
   ```

5. **Vérifier production** :
   - Vérifier les journaux d'application
   - Surveiller les taux d'erreur
   - Vérifier les fonctionnalités clés

6. **Générer les types TypeScript** :
   ```bash
   supabase gen types typescript > packages/data/src/types/database.generated.ts
   ```

### Post-Déploiement

1. **Surveiller l'application** pendant 24 heures
2. **Vérifier les métriques de performance**
3. **Revoir les journaux d'audit** pour activité inhabituelle
4. **Mettre à jour la documentation** si le schéma a changé
5. **Communiquer les changements** à l'équipe

## Procédure d'Annulation

Si des problèmes surviennent après le déploiement :

1. **Évaluer l'impact** - Déterminer la gravité et les utilisateurs affectés

2. **Points de décision** :
   - **Le code peut-il être annulé ?** (si le schéma est rétrocompatible)
   - **La migration doit-elle être annulée ?** (perte ou corruption de données)

3. **Options d'annulation** :

   **Option A : Annuler le code seulement** (si la migration est rétrocompatible)
   ```bash
   # Déployer la version précédente de l'application
   vercel rollback --yes
   ```

   **Option B : Annuler la migration** (si nécessaire)
   ```bash
   # Créer une migration d'annulation
   supabase migration new rollback_XXX

   # Ajouter le SQL de migration down à la migration d'annulation
   # Appliquer la migration d'annulation
   supabase db push
   ```

   **Option C : Restaurer depuis sauvegarde** (dernier recours)
   ```bash
   # Contacter le support Supabase
   # Ou utiliser l'outil de sauvegarde
   pg_restore --clean --if-exists -d "$DATABASE_URL" backup_YYYYMMDD.sql
   ```

## Dépannage des Migrations

### Échec de l'Application de la Migration

**Symptômes** : Erreur lors de l'exécution de `supabase db push`

**Solutions** :
1. Vérifier le SQL de migration pour erreurs de syntaxe
2. Vérifier que les dépendances (tables, colonnes) existent
3. Vérifier les violations de contraintes
4. Revoir attentivement le message d'erreur

### Incohérence des Données Après Migration

**Symptômes** : L'application affiche des données incorrectes

**Solutions** :
1. Vérifier la logique du SQL de migration de données
2. Vérifier les mises à jour partielles (transactions)
3. Revoir les définitions de contraintes
4. Restaurer depuis sauvegarde si nécessaire

### Dégradation des Performances

**Symptômes** : Requêtes lentes après la migration

**Solutions** :
1. Vérifier si les index ont été créés
2. Analyser les plans d'exécution des requêtes
3. Ajouter les index manquants
4. Envisager le réglage de la base de données

### Stratégies RLS Non Fonctionnelles

**Symptômes** : Les utilisateurs peuvent accéder à des données qu'ils ne devraient pas

**Solutions** :
1. Vérifier que RLS est activé : `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Vérifier les définitions de stratégies
3. Tester avec des ID utilisateurs réels
4. Revoir la précédence des stratégies

## Sujets Avancés

### Tables Partitionnées

Pour les grandes tables (comme audit_logs), utilisez le partitionnement :

```sql
-- Créer une table partitionnée
CREATE TABLE audit_logs (
  -- ... colonnes ...
) PARTITION BY RANGE (timestamp);

-- Créer les partitions
CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_logs_y2024m02 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-02-01') TO ('2024-04-01');

-- Créer un index sur la table partitionnée
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
```

### Triggers de Base de Données

Pour les mises à jour automatiques :

```sql
-- Mettre à jour l'horodatage updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Procédures Stockées

Pour les opérations complexes :

```sql
-- Calculer la moyenne de l'étudiant
CREATE OR REPLACE FUNCTION calculate_student_gpa(p_student_id UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  v_gpa DECIMAL(3,2);
BEGIN
  SELECT AVG(
    CASE
      WHEN grade = 'A' THEN 4.0
      WHEN grade = 'B' THEN 3.0
      WHEN grade = 'C' THEN 2.0
      WHEN grade = 'D' THEN 1.0
      ELSE 0.0
    END
  ) INTO v_gpa
  FROM student_grades
  WHERE student_id = p_student_id
    AND status = 'published';

  RETURN COALESCE(v_gpa, 0.0);
END;
$$ LANGUAGE plpgsql;
```

## Ressources

- **Documentation CLI Supabase** : https://supabase.com/docs/reference/cli
- **Documentation PostgreSQL** : https://www.postgresql.org/docs/current/ddl.html
- **Meilleures Pratiques de Migration** : Voir [Runbooks de Déploiement](../runbooks/deployment.md)
- **Stratégies RLS** : Voir [Liste de Vérification RLS](../security/rls-checklist.md)
