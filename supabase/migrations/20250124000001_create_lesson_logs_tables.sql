-- =====================================================
-- Migration: Create lesson_logs tables
-- Description: Database schema for the geolocated lesson log system
-- =====================================================

-- Create enum for lesson log status
CREATE TYPE lesson_log_status_enum AS ENUM (
  'draft',
  'pending_validation',
  'validated',
  'rejected'
);

-- COMMENT ON TYPE
COMMENT ON TYPE lesson_log_status_enum IS 'Status of a lesson log: draft (editable), pending_validation (submitted to admin), validated (approved by admin), rejected (rejected by admin)';

-- Create lesson_logs table
CREATE TABLE lesson_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  planned_session_id UUID NOT NULL REFERENCES planned_sessions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,

  -- Session details
  session_date DATE NOT NULL,
  theme VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  homework TEXT,
  duration_minutes INTEGER NOT NULL,

  -- Status and validation
  status lesson_log_status_enum DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Geolocation data (required for validation)
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  wifi_ssid VARCHAR(100),
  device_info JSONB DEFAULT '{}',

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT lesson_logs_planned_session_teacher_unique UNIQUE (planned_session_id, teacher_id),
  CONSTRAINT lesson_logs_theme_length CHECK (char_length(theme) >= 3 AND char_length(theme) <= 200),
  CONSTRAINT lesson_logs_content_length CHECK (char_length(content) >= 10),
  CONSTRAINT lesson_logs_duration_check CHECK (duration_minutes >= 15 AND duration_minutes <= 300),
  CONSTRAINT lesson_logs_latitude_range CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT lesson_logs_longitude_range CHECK (longitude >= -180 AND longitude <= 180)
);

-- Comments on table and columns
COMMENT ON TABLE lesson_logs IS 'Geolocated lesson logs (cahier de texte) linking planned sessions to payable teacher hours';
COMMENT ON COLUMN lesson_logs.id IS 'Unique identifier for the lesson log';
COMMENT ON COLUMN lesson_logs.school_id IS 'Reference to the school';
COMMENT ON COLUMN lesson_logs.planned_session_id IS 'Reference to the planned session from the schedule';
COMMENT ON COLUMN lesson_logs.teacher_id IS 'Reference to the teacher who created the log';
COMMENT ON COLUMN lesson_logs.class_id IS 'Reference to the class';
COMMENT ON COLUMN lesson_logs.subject_id IS 'Reference to the subject';
COMMENT ON COLUMN lesson_logs.session_date IS 'Date of the session';
COMMENT ON COLUMN lesson_logs.theme IS 'Theme/topic of the session (min 3 chars, max 200 chars)';
COMMENT ON COLUMN lesson_logs.content IS 'Detailed content of the lesson (min 10 chars)';
COMMENT ON COLUMN lesson_logs.homework IS 'Homework assigned to students (optional)';
COMMENT ON COLUMN lesson_logs.duration_minutes IS 'Actual duration of the session in minutes (15-300)';
COMMENT ON COLUMN lesson_logs.status IS 'Current status: draft, pending_validation, validated, rejected';
COMMENT ON COLUMN lesson_logs.submitted_at IS 'Timestamp when the log was submitted for validation';
COMMENT ON COLUMN lesson_logs.validated_at IS 'Timestamp when the log was validated';
COMMENT ON COLUMN lesson_logs.validated_by IS 'Reference to the admin who validated the log';
COMMENT ON COLUMN lesson_logs.rejected_at IS 'Timestamp when the log was rejected';
COMMENT ON COLUMN lesson_logs.rejection_reason IS 'Reason for rejection (required when rejected)';
COMMENT ON COLUMN lesson_logs.latitude IS 'GPS latitude of the teacher when creating the log';
COMMENT ON COLUMN lesson_logs.longitude IS 'GPS longitude of the teacher when creating the log';
COMMENT ON COLUMN lesson_logs.wifi_ssid IS 'WiFi SSID if WiFi validation is required';
COMMENT ON COLUMN lesson_logs.device_info IS 'Device information (platform, app version, etc.)';
COMMENT ON COLUMN lesson_logs.metadata IS 'Additional metadata in JSONB format';

-- Create lesson_log_documents table
CREATE TABLE lesson_log_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_log_id UUID NOT NULL REFERENCES lesson_logs(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- File information
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Upload metadata
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Constraints
  CONSTRAINT lesson_log_documents_file_size_check CHECK (file_size > 0 AND file_size <= 20971520) -- Max 20MB
);

-- Comments on lesson_log_documents
COMMENT ON TABLE lesson_log_documents IS 'Documents attached to lesson logs (stored in Supabase Storage)';
COMMENT ON COLUMN lesson_log_documents.lesson_log_id IS 'Reference to the lesson log';
COMMENT ON COLUMN lesson_log_documents.school_id IS 'Reference to the school (for storage organization)';
COMMENT ON COLUMN lesson_log_documents.file_name IS 'Original file name';
COMMENT ON COLUMN lesson_log_documents.file_path IS 'Path in Supabase Storage';
COMMENT ON COLUMN lesson_log_documents.file_size IS 'File size in bytes (max 20MB)';
COMMENT ON COLUMN lesson_log_documents.mime_type IS 'MIME type of the file';
COMMENT ON COLUMN lesson_log_documents.uploaded_by IS 'Reference to the user who uploaded the document';
COMMENT ON COLUMN lesson_log_documents.uploaded_at IS 'Timestamp when the document was uploaded';
COMMENT ON COLUMN lesson_log_documents.metadata IS 'Additional metadata in JSONB format';

-- Create indexes for lesson_logs
CREATE INDEX idx_lesson_logs_school_id ON lesson_logs(school_id);
CREATE INDEX idx_lesson_logs_teacher_id ON lesson_logs(teacher_id);
CREATE INDEX idx_lesson_logs_class_id ON lesson_logs(class_id);
CREATE INDEX idx_lesson_logs_status ON lesson_logs(status);
CREATE INDEX idx_lesson_logs_session_date ON lesson_logs(session_date);
CREATE INDEX idx_lesson_logs_planned_session_id ON lesson_logs(planned_session_id);
CREATE INDEX idx_lesson_logs_teacher_date_status ON lesson_logs(teacher_id, session_date, status);

-- Comments on indexes
COMMENT ON INDEX idx_lesson_logs_school_id IS 'Index for filtering by school';
COMMENT ON INDEX idx_lesson_logs_teacher_id IS 'Index for filtering by teacher';
COMMENT ON INDEX idx_lesson_logs_class_id IS 'Index for filtering by class';
COMMENT ON INDEX idx_lesson_logs_status IS 'Index for filtering by status';
COMMENT ON INDEX idx_lesson_logs_session_date IS 'Index for filtering by session date';
COMMENT ON INDEX idx_lesson_logs_planned_session_id IS 'Index for joining with planned_sessions';
COMMENT ON INDEX idx_lesson_logs_teacher_date_status IS 'Composite index for teacher queries with date and status filters';

-- Create indexes for lesson_log_documents
CREATE INDEX idx_lesson_log_documents_lesson_log_id ON lesson_log_documents(lesson_log_id);
CREATE INDEX idx_lesson_log_documents_school_id ON lesson_log_documents(school_id);

-- Comments on indexes
COMMENT ON INDEX idx_lesson_log_documents_lesson_log_id IS 'Index for retrieving documents by lesson log';
COMMENT ON INDEX idx_lesson_log_documents_school_id IS 'Index for filtering by school';

-- Create trigger function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on lesson_logs
CREATE TRIGGER update_lesson_logs_updated_at
  BEFORE UPDATE ON lesson_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically update the updated_at column before each update';
