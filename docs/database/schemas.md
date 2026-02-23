# Schémas de Base de Données

## Vue d'ensemble

NovaConnect utilise PostgreSQL comme base de données principale, hébergée sur Supabase. Le schéma est conçu pour supporter la gestion multi-établissement scolaire avec un isolement et une sécurité appropriés.

## Principes d'Architecture

1. **Multi-tenance** : Les données de chaque école sont isolées en utilisant la Sécurité au Niveau Ligne (RLS)
2. **Traçabilité** : Toutes les tables suivent les horodatages de création/mise à jour et les ID utilisateurs
3. **Intégrité des Données** : Les clés étrangères et contraintes assurent la cohérence des données
4. **Performance** : Colonnes indexées pour des requêtes rapides
5. **Sécurité** : Les stratégies RLS appliquent le contrôle d'accès au niveau de la base de données

## Tables Principales

### schools

Stocke la configuration et les paramètres de l'école.

```sql
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  address JSONB,
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  website VARCHAR(255),
  settings JSONB DEFAULT '{}',
  subscription_plan VARCHAR(50) DEFAULT 'basic',
  subscription_status VARCHAR(50) DEFAULT 'active',
  license_max_students INTEGER,
  license_max_teachers INTEGER,
  license_expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_schools_slug ON schools(slug);
CREATE INDEX idx_schools_subscription_status ON schools(subscription_status);
```

**Champs :**
- `settings` : JSONB contenant la configuration spécifique à l'école
  - `academic_year` : ID de l'année scolaire actuelle
  - `grading_scale` : Configuration de l'échelle de notation
  - `attendance_rules` : Règles de présence
  - `notification_settings` : Préférences de notification par défaut

### users

Comptes utilisateurs pour tous les utilisateurs du système (admin, enseignants, parents, étudiants).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  password_hash VARCHAR(255),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'super_admin', 'school_admin', 'teacher', 'student', 'parent', 'accountant'
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
```

### user_roles

Relation plusieurs-à-plusieurs entre utilisateurs et rôles pour des permissions flexibles.

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, school_id, role)
);

-- Index
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_school_id ON user_roles(school_id);
```

### students

Inscription et informations académiques des étudiants.

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  matricule VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  photo_url TEXT,
  address JSONB,
  enrollment_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'graduated', 'transferred'
  grade_id UUID REFERENCES grades(id),
  class_id UUID REFERENCES classes(id),
  campus_id UUID REFERENCES campuses(id),
  parent_id UUID REFERENCES parents(id),
  medical_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_matricule ON students(matricule);
CREATE INDEX idx_students_grade_id ON students(grade_id);
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_students_parent_id ON students(parent_id);
CREATE INDEX idx_students_status ON students(status);
```

### parents

Informations sur les parents/tuteurs.

```sql
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50),
  phone VARCHAR(50),
  email VARCHAR(255),
  address JSONB,
  occupation VARCHAR(100),
  emergency_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_parents_school_id ON parents(school_id);
CREATE INDEX idx_parents_user_id ON parents(user_id);
CREATE INDEX idx_parents_email ON parents(email);
```

### grades (Niveaux Scolaires)

Niveaux scolaires (ex: 6ème, Terminale, etc.).

```sql
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  level INTEGER NOT NULL,
  division VARCHAR(50),
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- Index
CREATE INDEX idx_grades_school_id ON grades(school_id);
CREATE INDEX idx_grades_level ON grades(level);
```

### classes

Classes (ex: 6A, Terminale B).

```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES grades(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  room VARCHAR(50),
  capacity INTEGER,
  class_teacher_id UUID REFERENCES users(id),
  campus_id UUID REFERENCES campuses(id),
  academic_year_id UUID REFERENCES academic_years(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, grade_id, name, academic_year_id)
);

-- Index
CREATE INDEX idx_classes_school_id ON classes(school_id);
CREATE INDEX idx_classes_grade_id ON classes(grade_id);
CREATE INDEX idx_classes_academic_year_id ON classes(academic_year_id);
```

### subjects

Matières enseignées dans l'école.

```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, code)
);

-- Index
CREATE INDEX idx_subjects_school_id ON subjects(school_id);
```

### teacher_assignments

Affectation des enseignants aux classes et matières.

```sql
CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, class_id, subject_id, academic_year_id)
);

-- Index
CREATE INDEX idx_teacher_assignments_teacher_id ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_class_id ON teacher_assignments(class_id);
CREATE INDEX idx_teacher_assignments_subject_id ON teacher_assignments(subject_id);
```

## Tables des Enregistrements Académiques

### student_grades

Notes des étudiants.

```sql
CREATE TABLE student_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  term VARCHAR(50) NOT NULL,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  assessment_type VARCHAR(50) NOT NULL, -- 'assignment', 'test', 'exam', 'project'
  score DECIMAL(5,2) NOT NULL,
  max_score DECIMAL(5,2) NOT NULL,
  grade VARCHAR(10),
  comments TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'published', 'archived'
  graded_by UUID REFERENCES users(id),
  graded_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_student_grades_student_id ON student_grades(student_id);
CREATE INDEX idx_student_grades_subject_id ON student_grades(subject_id);
CREATE INDEX idx_student_grades_class_id ON student_grades(class_id);
CREATE INDEX idx_student_grades_academic_year_id ON student_grades(academic_year_id);
CREATE INDEX idx_student_grades_status ON student_grades(status);
```

### attendance_records

Enregistrements de présence des étudiants.

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'present', 'absent', 'late', 'excused'
  remarks TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, session_id, date)
);

-- Index
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_session_id ON attendance_records(session_id);
CREATE INDEX idx_attendance_records_date ON attendance_records(date);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);
```

### attendance_sessions

Configuration des sessions de présence (période de classe).

```sql
CREATE TABLE attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period INTEGER,
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_attendance_sessions_class_id ON attendance_sessions(class_id);
CREATE INDEX idx_attendance_sessions_date ON attendance_sessions(date);
```

## Tables Financières

### fee_types

Types de frais facturés par l'école.

```sql
CREATE TABLE fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_fee_types_school_id ON fee_types(school_id);
```

### fee_schedules

Échéanciers de paiement pour les étudiants.

```sql
CREATE TABLE fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  fee_type_id UUID REFERENCES fee_types(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'overdue', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_fee_schedules_student_id ON fee_schedules(student_id);
CREATE INDEX idx_fee_schedules_school_id ON fee_schedules(school_id);
CREATE INDEX idx_fee_schedules_due_date ON fee_schedules(due_date);
CREATE INDEX idx_fee_schedules_status ON fee_schedules(status);
```

### payments

Paiements enregistrés.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  fee_schedule_id UUID REFERENCES fee_schedules(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'cash', 'bank_transfer', 'mobile_money', 'check'
  transaction_ref VARCHAR(255),
  receipt_url TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  received_by UUID REFERENCES users(id),
  payment_date DATE NOT NULL,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_school_id ON payments(school_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_transaction_ref ON payments(transaction_ref);
```

## Tables Système

### academic_years

Configuration de l'année scolaire.

```sql
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);
```

### campuses

Sites campus (pour les écoles multi-campus).

```sql
CREATE TABLE campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address JSONB,
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### audit_logs

Journal d'audit du système.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL, -- 'create', 'read', 'update', 'delete'
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  school_id UUID REFERENCES schools(id),
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(50), -- 'success', 'failure'
  details JSONB,
  changed_fields TEXT[],
  old_values JSONB,
  new_values JSONB
);

-- Index
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_school_id ON audit_logs(school_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
-- Partition par timestamp pour de meilleures performances
CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Diagramme ER

```
schools (1) ----< (plusieurs) users
schools (1) ----< (plusieurs) students
schools (1) ----< (plusieurs) classes
schools (1) ----< (plusieurs) grades (niveaux scolaires)
schools (1) ----< (plusieurs) subjects

grades (1) ----< (plusieurs) classes
classes (1) ----< (plusieurs) students
classes (1) ----< (plusieurs) teacher_assignments
classes (1) ----< (plusieurs) student_grades
classes (1) ----< (plusieurs) attendance_sessions

students (1) ----< (plusieurs) student_grades
students (1) ----< (plusieurs) attendance_records
students (1) ----< (plusieurs) fee_schedules
students (1) ----< (plusieurs) payments

subjects (1) ----< (plusieurs) teacher_assignments
subjects (1) ----< (plusieurs) student_grades

users (enseignants) ----< teacher_assignments
users (enseignants) ----< student_grades (graded_by)
users (enseignants) ----< attendance_sessions (teacher_id)

attendance_sessions (1) ----< (plusieurs) attendance_records
```

## Planification de la Taille de Base de Données

Tailles estimées par école :

| Table | Enregistrements par An | Stockage par Enregistrement | Stockage Annuel |
|-------|-------------------------|----------------------------|-----------------|
| students | 500 | 2 KB | 1 MB |
| users | 1500 | 1.5 KB | 2.25 MB |
| student_grades | 15,000 | 1 KB | 15 MB |
| attendance_records | 150,000 | 0.5 KB | 75 MB |
| payments | 5,000 | 1 KB | 5 MB |
| audit_logs | 500,000 | 2 KB | 1 GB |
| **Total** | | | **~1.1 GB/an** |

## Stratégie de Sauvegarde

- **Sauvegardes automatisées** : Quotidiennes à 2 AM UTC
- **Rétention** : 7 sauvegardes quotidiennes, 4 hebdomadaires, 12 mensuelles
- **Récupération à un moment donné** : Jusqu'à 35 jours
- **Redondance géographique** : Sauvegardes répliquées dans plusieurs régions

## Stratégie de Migration

Voir le [Guide des Migrations](./migrations.md) pour les procédures de migration de la base de données.
