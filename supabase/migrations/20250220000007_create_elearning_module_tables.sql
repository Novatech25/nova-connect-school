-- E-Learning Module Tables Migration
-- Creates all tables, ENUMs, indexes, and storage buckets for the e-learning module

-- Create ENUMs
CREATE TYPE assignment_status_enum AS ENUM ('draft', 'published', 'closed', 'archived');
CREATE TYPE submission_status_enum AS ENUM ('pending', 'submitted', 'graded', 'returned');
CREATE TYPE resource_type_enum AS ENUM ('document', 'video', 'link', 'other');

-- Create assignments table (devoirs créés par les profs)
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT,
  status assignment_status_enum DEFAULT 'draft',
  due_date TIMESTAMPTZ NOT NULL,
  max_score DECIMAL(5,2) DEFAULT 20.00,
  allow_late_submission BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT assignments_title_min_length CHECK (char_length(title) >= 3),
  CONSTRAINT assignments_max_score_positive CHECK (max_score > 0)
);

-- Create indexes for assignments
CREATE INDEX idx_assignments_school_id ON assignments(school_id);
CREATE INDEX idx_assignments_teacher_id ON assignments(teacher_id);
CREATE INDEX idx_assignments_class_id ON assignments(class_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);

-- Create assignment_files table (fichiers joints aux devoirs par le prof)
CREATE TABLE assignment_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT assignment_files_size_valid CHECK (file_size > 0 AND file_size <= 52428800)
);

-- Create indexes for assignment_files
CREATE INDEX idx_assignment_files_assignment_id ON assignment_files(assignment_id);
CREATE INDEX idx_assignment_files_school_id ON assignment_files(school_id);

-- Create assignment_submissions table (dépôts élèves)
CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  status submission_status_enum DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  score DECIMAL(5,2),
  teacher_comment TEXT,
  is_late BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT assignment_submissions_unique UNIQUE (assignment_id, student_id),
  CONSTRAINT assignment_submissions_score_valid CHECK (score IS NULL OR (score >= 0 AND score <= 20))
);

-- Create indexes for assignment_submissions
CREATE INDEX idx_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX idx_submissions_status ON assignment_submissions(status);
CREATE INDEX idx_submissions_school_id ON assignment_submissions(school_id);

-- Create submission_files table (fichiers déposés par élèves)
CREATE TABLE submission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT submission_files_size_valid CHECK (file_size > 0 AND file_size <= 52428800)
);

-- Create indexes for submission_files
CREATE INDEX idx_submission_files_submission_id ON submission_files(submission_id);
CREATE INDEX idx_submission_files_school_id ON submission_files(school_id);

-- Create correction_files table (fichiers de correction par prof)
CREATE TABLE correction_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT correction_files_size_valid CHECK (file_size > 0 AND file_size <= 52428800)
);

-- Create indexes for correction_files
CREATE INDEX idx_correction_files_submission_id ON correction_files(submission_id);
CREATE INDEX idx_correction_files_school_id ON correction_files(school_id);

-- Create course_resources table (ressources de cours par prof)
CREATE TABLE course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  resource_type resource_type_enum DEFAULT 'document',
  file_path TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  external_url TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT course_resources_file_size_valid CHECK (file_size IS NULL OR (file_size > 0 AND file_size <= 104857600))
);

-- Create indexes for course_resources
CREATE INDEX idx_resources_school_id ON course_resources(school_id);
CREATE INDEX idx_resources_teacher_id ON course_resources(teacher_id);
CREATE INDEX idx_resources_class_id ON course_resources(class_id);
CREATE INDEX idx_resources_subject_id ON course_resources(subject_id);
CREATE INDEX idx_resources_published ON course_resources(is_published);

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignment_submissions_updated_at BEFORE UPDATE ON assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_resources_updated_at BEFORE UPDATE ON course_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage buckets
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES
--   ('assignment-files', 'assignment-files', false, 52428800,
--    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--          'image/jpeg', 'image/png', 'application/zip']),
--   ('submission-files', 'submission-files', false, 52428800,
--    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--          'image/jpeg', 'image/png', 'application/zip']),
--   ('correction-files', 'correction-files', false, 52428800,
--    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--          'image/jpeg', 'image/png']),
--   ('course-resources', 'course-resources', false, 104857600,
--    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--          'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
--          'image/jpeg', 'image/png', 'video/mp4', 'application/zip'])
-- ON CONFLICT (id) DO NOTHING;;
