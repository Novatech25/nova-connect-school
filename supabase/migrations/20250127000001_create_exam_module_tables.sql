-- Migration: Create Exam Module Tables
-- Created: 2025-01-27
-- Description: Creates the database schema for the exam management module

-- Enums pour le module examen
CREATE TYPE exam_session_status_enum AS ENUM ('draft', 'planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE exam_type_enum AS ENUM ('composition', 'exam', 'final_exam', 'certification');
CREATE TYPE deliberation_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'published');
CREATE TYPE exam_minute_status_enum AS ENUM ('draft', 'validated', 'signed', 'archived');

-- Table exam_sessions : sessions d'examen
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  period_id UUID REFERENCES periods(id) ON DELETE SET NULL,

  name VARCHAR(200) NOT NULL,
  exam_type exam_type_enum NOT NULL,
  description TEXT,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  status exam_session_status_enum NOT NULL DEFAULT 'draft',

  -- Configuration
  requires_jury BOOLEAN DEFAULT true,
  requires_deliberation BOOLEAN DEFAULT true,
  requires_official_minutes BOOLEAN DEFAULT true,

  -- Workflow
  planned_at TIMESTAMPTZ,
  planned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exam_sessions_dates_valid CHECK (end_date >= start_date)
);

-- Table exam_centers : centres d'examen
CREATE TABLE exam_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,
  code VARCHAR(50),
  address TEXT,
  capacity INTEGER,

  -- Géolocalisation (optionnel)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Responsable du centre
  supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table exam_juries : composition des jurys
CREATE TABLE exam_juries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Président du jury
  president_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Membres du jury (array d'UUIDs)
  member_ids UUID[] DEFAULT ARRAY[]::UUID[],

  -- Classes/niveaux concernés
  class_ids UUID[] DEFAULT ARRAY[]::UUID[],

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table exam_assignments : affectation élèves → centres
CREATE TABLE exam_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,

  seat_number VARCHAR(50),
  is_present BOOLEAN DEFAULT false,
  absence_reason TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exam_assignments_unique UNIQUE (exam_session_id, student_id)
);

-- Table exam_grades : notes d'examen (extension de grades)
CREATE TABLE exam_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,

  -- Validation jury
  validated_by_jury BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Contestation
  is_contested BOOLEAN DEFAULT false,
  contest_reason TEXT,
  contest_resolution TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exam_grades_unique UNIQUE (exam_session_id, grade_id)
);

-- Table exam_deliberations : délibérations
CREATE TABLE exam_deliberations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  jury_id UUID NOT NULL REFERENCES exam_juries(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,

  deliberation_date DATE NOT NULL,
  status deliberation_status_enum NOT NULL DEFAULT 'pending',

  -- Résultats
  total_students INTEGER NOT NULL DEFAULT 0,
  passed_students INTEGER NOT NULL DEFAULT 0,
  failed_students INTEGER NOT NULL DEFAULT 0,

  -- Décisions spéciales (JSON array)
  special_decisions JSONB DEFAULT '[]'::jsonb,

  -- Workflow
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,

  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table exam_results : résultats finaux par étudiant
CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  deliberation_id UUID NOT NULL REFERENCES exam_deliberations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  overall_average DECIMAL(5,2) NOT NULL,
  rank_in_class INTEGER,
  class_size INTEGER NOT NULL,

  -- Décision
  is_passed BOOLEAN NOT NULL,
  mention VARCHAR(50),
  mention_color VARCHAR(7),

  -- Décisions spéciales
  special_decision TEXT,
  jury_comments TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exam_results_unique UNIQUE (exam_session_id, student_id),
  CONSTRAINT exam_results_average_valid CHECK (overall_average >= 0 AND overall_average <= 20)
);

-- Table exam_minutes : procès-verbaux
CREATE TABLE exam_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  deliberation_id UUID REFERENCES exam_deliberations(id) ON DELETE SET NULL,

  minute_type VARCHAR(50) NOT NULL, -- 'session', 'deliberation', 'final'
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,

  status exam_minute_status_enum NOT NULL DEFAULT 'draft',

  -- Signatures
  signatures JSONB DEFAULT '[]'::jsonb, -- [{user_id, role, signed_at, signature_data}]

  -- PDF
  pdf_url TEXT,
  pdf_size_bytes INTEGER,

  -- Workflow
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes exam_sessions
CREATE INDEX idx_exam_sessions_school_id ON exam_sessions(school_id);
CREATE INDEX idx_exam_sessions_academic_year_id ON exam_sessions(academic_year_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions(status);
CREATE INDEX idx_exam_sessions_dates ON exam_sessions(start_date, end_date);

-- Indexes exam_centers
CREATE INDEX idx_exam_centers_school_id ON exam_centers(school_id);
CREATE INDEX idx_exam_centers_exam_session_id ON exam_centers(exam_session_id);

-- Indexes exam_juries
CREATE INDEX idx_exam_juries_school_id ON exam_juries(school_id);
CREATE INDEX idx_exam_juries_exam_session_id ON exam_juries(exam_session_id);
CREATE INDEX idx_exam_juries_president_id ON exam_juries(president_id);

-- Indexes exam_assignments
CREATE INDEX idx_exam_assignments_school_id ON exam_assignments(school_id);
CREATE INDEX idx_exam_assignments_exam_session_id ON exam_assignments(exam_session_id);
CREATE INDEX idx_exam_assignments_student_id ON exam_assignments(student_id);
CREATE INDEX idx_exam_assignments_exam_center_id ON exam_assignments(exam_center_id);

-- Indexes exam_grades
CREATE INDEX idx_exam_grades_school_id ON exam_grades(school_id);
CREATE INDEX idx_exam_grades_exam_session_id ON exam_grades(exam_session_id);
CREATE INDEX idx_exam_grades_grade_id ON exam_grades(grade_id);

-- Indexes exam_deliberations
CREATE INDEX idx_exam_deliberations_school_id ON exam_deliberations(school_id);
CREATE INDEX idx_exam_deliberations_exam_session_id ON exam_deliberations(exam_session_id);
CREATE INDEX idx_exam_deliberations_jury_id ON exam_deliberations(jury_id);
CREATE INDEX idx_exam_deliberations_status ON exam_deliberations(status);

-- Indexes exam_results
CREATE INDEX idx_exam_results_school_id ON exam_results(school_id);
CREATE INDEX idx_exam_results_exam_session_id ON exam_results(exam_session_id);
CREATE INDEX idx_exam_results_student_id ON exam_results(student_id);
CREATE INDEX idx_exam_results_deliberation_id ON exam_results(deliberation_id);

-- Indexes exam_minutes
CREATE INDEX idx_exam_minutes_school_id ON exam_minutes(school_id);
CREATE INDEX idx_exam_minutes_exam_session_id ON exam_minutes(exam_session_id);
CREATE INDEX idx_exam_minutes_status ON exam_minutes(status);

-- Triggers updated_at
CREATE TRIGGER update_exam_sessions_updated_at
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_centers_updated_at
  BEFORE UPDATE ON exam_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_juries_updated_at
  BEFORE UPDATE ON exam_juries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_assignments_updated_at
  BEFORE UPDATE ON exam_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_grades_updated_at
  BEFORE UPDATE ON exam_grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_deliberations_updated_at
  BEFORE UPDATE ON exam_deliberations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_results_updated_at
  BEFORE UPDATE ON exam_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_minutes_updated_at
  BEFORE UPDATE ON exam_minutes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: Storage bucket 'exam-documents' should be created manually in Supabase dashboard if needed
