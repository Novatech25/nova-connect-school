-- ============================================
-- Migration: Grades System Tables
-- Created: 2025-01-25
-- Description: Creates tables for grade management including grades, versions, and submissions
-- ============================================

-- ============================================
-- ENUMs
-- ============================================

-- Statut du workflow de notes
CREATE TYPE grade_status_enum AS ENUM ('draft', 'submitted', 'approved', 'published');

-- Type de note (devoir, examen, contrôle, projet, participation)
CREATE TYPE grade_type_enum AS ENUM ('homework', 'exam', 'quiz', 'project', 'participation', 'composition');

-- Statut de soumission collective
CREATE TYPE grade_submission_status_enum AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- ============================================
-- Table: grades (notes individuelles)
-- ============================================

CREATE TABLE grades (
  -- Primary keys and IDs
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,

  -- Grade details
  grade_type grade_type_enum NOT NULL,
  title VARCHAR(200) NOT NULL,
  score DECIMAL(5, 2) NOT NULL,
  max_score DECIMAL(5, 2) NOT NULL,
  coefficient DECIMAL(3, 2) NOT NULL DEFAULT 1.0,
  weight DECIMAL(3, 2) NOT NULL DEFAULT 1.0,

  -- Workflow fields
  status grade_status_enum NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,

  -- Locking fields
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Metadata
  comments TEXT,
  metadata JSONB,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT grades_score_valid CHECK (score >= 0 AND score <= max_score),
  CONSTRAINT grades_max_score_positive CHECK (max_score > 0),
  CONSTRAINT grades_coefficient_positive CHECK (coefficient > 0)
);

-- Indexes for grades table
CREATE INDEX idx_grades_school_id ON grades(school_id);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_subject_id ON grades(subject_id);
CREATE INDEX idx_grades_class_id ON grades(class_id);
CREATE INDEX idx_grades_period_id ON grades(period_id);
CREATE INDEX idx_grades_status ON grades(status);
CREATE INDEX idx_grades_teacher_id ON grades(teacher_id);
CREATE INDEX idx_grades_student_period_subject ON grades(student_id, period_id, subject_id);
CREATE INDEX idx_grades_created_at ON grades(created_at DESC);

-- ============================================
-- Table: grade_versions (historique des modifications)
-- ============================================

CREATE TABLE grade_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Change tracking
  previous_score DECIMAL(5, 2),
  new_score DECIMAL(5, 2),
  previous_status grade_status_enum,
  new_status grade_status_enum,
  change_reason TEXT,

  -- Who made the change
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Additional metadata
  metadata JSONB,

  -- Constraints
  CONSTRAINT grade_versions_version_positive CHECK (version_number > 0)
);

-- Indexes for grade_versions table
CREATE INDEX idx_grade_versions_grade_id ON grade_versions(grade_id);
CREATE INDEX idx_grade_versions_changed_by ON grade_versions(changed_by);
CREATE INDEX idx_grade_versions_changed_at ON grade_versions(changed_at DESC);
CREATE INDEX idx_grade_versions_school_id ON grade_versions(school_id);

-- ============================================
-- Table: grade_submissions (soumissions collectives)
-- ============================================

CREATE TABLE grade_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,

  -- Workflow fields
  status grade_submission_status_enum NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Statistics
  total_grades INTEGER NOT NULL DEFAULT 0,
  grades_entered INTEGER NOT NULL DEFAULT 0,
  completion_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.0,

  -- Additional notes and metadata
  notes TEXT,
  metadata JSONB,

  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT grade_submissions_unique UNIQUE (school_id, teacher_id, class_id, subject_id, period_id, academic_year_id),
  CONSTRAINT grade_submissions_completion_valid CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

-- Indexes for grade_submissions table
CREATE INDEX idx_grade_submissions_school_id ON grade_submissions(school_id);
CREATE INDEX idx_grade_submissions_teacher_id ON grade_submissions(teacher_id);
CREATE INDEX idx_grade_submissions_class_id ON grade_submissions(class_id);
CREATE INDEX idx_grade_submissions_status ON grade_submissions(status);
CREATE INDEX idx_grade_submissions_period_id ON grade_submissions(period_id);
CREATE INDEX idx_grade_submissions_subject_id ON grade_submissions(subject_id);
CREATE INDEX idx_grade_submissions_created_at ON grade_submissions(created_at DESC);

-- ============================================
-- Triggers
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_grades_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grade_submissions_updated_at
  BEFORE UPDATE ON grade_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create grade version on significant changes
CREATE OR REPLACE FUNCTION create_grade_version()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
  changed_by_user UUID;
BEGIN
  -- Only create version if score or status changed
  IF (OLD.score IS DISTINCT FROM NEW.score) OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM grade_versions
    WHERE grade_id = NEW.id;

    -- Determine who made the change: prefer auth.uid(), fallback to approved_by or teacher_id
    changed_by_user := COALESCE(
      (SELECT auth.uid()),
      NEW.approved_by,
      NEW.teacher_id
    );

    -- Insert version record
    INSERT INTO grade_versions (
      grade_id,
      school_id,
      version_number,
      previous_score,
      new_score,
      previous_status,
      new_status,
      changed_by,
      changed_at
    )
    VALUES (
      NEW.id,
      NEW.school_id,
      next_version,
      OLD.score,
      NEW.score,
      OLD.status,
      NEW.status,
      changed_by_user,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply version tracking trigger
CREATE TRIGGER create_grade_version_trigger
  AFTER UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION create_grade_version();

-- Function to update submission statistics
CREATE OR REPLACE FUNCTION update_submission_stats()
RETURNS TRIGGER AS $$
DECLARE
  total_count INTEGER;
  entered_count INTEGER;
  completion_pct DECIMAL(5,2);
BEGIN
  -- Determine the submission to update based on the grade being modified
  IF TG_OP = 'INSERT' THEN
    -- Increment counts with safe NULL handling
    UPDATE grade_submissions
    SET
      grades_entered = grades_entered + 1,
      completion_percentage = CASE
        WHEN total_grades > 0 THEN (grades_entered + 1.0) * 100.0 / total_grades
        ELSE 0
      END
    WHERE
      school_id = NEW.school_id
      AND teacher_id = NEW.teacher_id
      AND class_id = NEW.class_id
      AND subject_id = NEW.subject_id
      AND period_id = NEW.period_id
      AND academic_year_id = NEW.academic_year_id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- No change to counts (just updating an existing grade)
    NULL;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement counts with safe NULL handling
    UPDATE grade_submissions
    SET
      grades_entered = grades_entered - 1,
      completion_percentage = CASE
        WHEN total_grades > 0 THEN (grades_entered - 1.0) * 100.0 / total_grades
        ELSE 0
      END
    WHERE
      school_id = OLD.school_id
      AND teacher_id = OLD.teacher_id
      AND class_id = OLD.class_id
      AND subject_id = OLD.subject_id
      AND period_id = OLD.period_id
      AND academic_year_id = OLD.academic_year_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply submission statistics trigger
CREATE TRIGGER update_submission_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION update_submission_stats();

-- Function to lock grade after publication
CREATE OR REPLACE FUNCTION lock_grade_after_publish()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.is_locked = true;
    NEW.locked_at = NOW();
    NEW.locked_by = (SELECT auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply lock trigger
CREATE TRIGGER lock_grade_on_publish_trigger
  BEFORE UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION lock_grade_after_publish();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get student grade average for a period
CREATE OR REPLACE FUNCTION get_student_period_average(
  p_student_id UUID,
  p_period_id UUID,
  p_subject_id UUID DEFAULT NULL
)
RETURNS TABLE (
  subject_id UUID,
  subject_name VARCHAR,
  average DECIMAL(5,2),
  total_coefficient DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as subject_id,
    s.name as subject_name,
    COALESCE(SUM(g.score * g.coefficient) / NULLIF(SUM(g.max_score * g.coefficient), 0), 0) * 20 as average,
    SUM(g.coefficient) as total_coefficient
  FROM grades g
  JOIN subjects s ON s.id = g.subject_id
  WHERE
    g.student_id = p_student_id
    AND g.period_id = p_period_id
    AND g.status = 'published'
    AND (p_subject_id IS NULL OR g.subject_id = p_subject_id)
  GROUP BY s.id, s.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get class grade statistics
CREATE OR REPLACE FUNCTION get_class_grade_statistics(
  p_class_id UUID,
  p_subject_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  average DECIMAL(5,2),
  min_grade DECIMAL(5,2),
  max_grade DECIMAL(5,2),
  count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(AVG(g.score), 0) as average,
    COALESCE(MIN(g.score), 0) as min_grade,
    COALESCE(MAX(g.score), 0) as max_grade,
    COUNT(g.id) as count
  FROM grades g
  WHERE
    g.class_id = p_class_id
    AND g.subject_id = p_subject_id
    AND g.period_id = p_period_id
    AND g.status = 'published';
END;
$$ LANGUAGE plpgsql;
