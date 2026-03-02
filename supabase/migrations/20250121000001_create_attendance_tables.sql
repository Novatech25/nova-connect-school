-- Migration: Attendance System Tables
-- Description: Creates attendance_sessions and attendance_records tables with enums, indexes, and triggers
-- Created: 2025-01-21

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Attendance status for individual students
CREATE TYPE attendance_status_enum AS ENUM (
  'present',   -- Student was present
  'absent',    -- Student was absent
  'late',      -- Student was late
  'excused'    -- Student was absent but excused
);

COMMENT ON TYPE attendance_status_enum IS 'Status of attendance for a student';

-- Source of the attendance record
CREATE TYPE attendance_source_enum AS ENUM (
  'teacher_manual',  -- Marked manually by teacher
  'qr_scan'          -- Scanned via QR code by student (future)
);

COMMENT ON TYPE attendance_source_enum IS 'How the attendance record was created';

-- Status of an attendance session
CREATE TYPE attendance_session_status_enum AS ENUM (
  'draft',     -- Teacher is currently taking attendance
  'submitted', -- Teacher has submitted attendance
  'validated'  -- Attendance has been validated by admin/supervisor
);

COMMENT ON TYPE attendance_session_status_enum IS 'Workflow status of an attendance session';

-- ============================================================================
-- TABLES
-- ============================================================================

-- Attendance Sessions: Represents a single attendance-taking session
CREATE TABLE attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  planned_session_id UUID NOT NULL REFERENCES planned_sessions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,

  -- Session info
  session_date DATE NOT NULL,

  -- Workflow
  status attendance_session_status_enum NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Additional info
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT attendance_sessions_planned_session_date_unique UNIQUE (planned_session_id, session_date)
);

COMMENT ON TABLE attendance_sessions IS 'Sessions for taking attendance, linked to planned sessions from the schedule';

COMMENT ON COLUMN attendance_sessions.id IS 'Unique identifier';
COMMENT ON COLUMN attendance_sessions.school_id IS 'School this session belongs to';
COMMENT ON COLUMN attendance_sessions.planned_session_id IS 'Reference to the planned session from the schedule';
COMMENT ON COLUMN attendance_sessions.teacher_id IS 'Teacher taking attendance';
COMMENT ON COLUMN attendance_sessions.class_id IS 'Class for which attendance is being taken';
COMMENT ON COLUMN attendance_sessions.session_date IS 'Date of the session';
COMMENT ON COLUMN attendance_sessions.status IS 'Current status: draft, submitted, or validated';
COMMENT ON COLUMN attendance_sessions.submitted_at IS 'When the teacher submitted the attendance';
COMMENT ON COLUMN attendance_sessions.validated_at IS 'When an admin validated the attendance';
COMMENT ON COLUMN attendance_sessions.validated_by IS 'Admin who validated the attendance';
COMMENT ON COLUMN attendance_sessions.notes IS 'Additional notes about the session';
COMMENT ON COLUMN attendance_sessions.metadata IS 'Additional metadata in JSON format';

-- Attendance Records: Individual student attendance records
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- Attendance info
  status attendance_status_enum NOT NULL,
  source attendance_source_enum NOT NULL DEFAULT 'teacher_manual',

  -- Additional info
  justification TEXT,
  comment TEXT,

  -- Audit
  marked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT attendance_records_session_student_unique UNIQUE (attendance_session_id, student_id)
);

COMMENT ON TABLE attendance_records IS 'Individual attendance records for students';

COMMENT ON COLUMN attendance_records.id IS 'Unique identifier';
COMMENT ON COLUMN attendance_records.attendance_session_id IS 'Reference to the attendance session';
COMMENT ON COLUMN attendance_records.school_id IS 'School this record belongs to';
COMMENT ON COLUMN attendance_records.student_id IS 'Student whose attendance is being recorded';
COMMENT ON COLUMN attendance_records.status IS 'Attendance status: present, absent, late, or excused';
COMMENT ON COLUMN attendance_records.source IS 'How this record was created';
COMMENT ON COLUMN attendance_records.justification IS 'Justification for absence/excused status';
COMMENT ON COLUMN attendance_records.comment IS 'Additional comments';
COMMENT ON COLUMN attendance_records.marked_by IS 'User who marked this attendance';
COMMENT ON COLUMN attendance_records.marked_at IS 'When this attendance was marked';
COMMENT ON COLUMN attendance_records.metadata IS 'Additional metadata in JSON format';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for attendance_sessions
CREATE INDEX idx_attendance_sessions_school_id ON attendance_sessions(school_id);
CREATE INDEX idx_attendance_sessions_planned_session_id ON attendance_sessions(planned_session_id);
CREATE INDEX idx_attendance_sessions_teacher_id ON attendance_sessions(teacher_id);
CREATE INDEX idx_attendance_sessions_class_id ON attendance_sessions(class_id);
CREATE INDEX idx_attendance_sessions_session_date ON attendance_sessions(session_date);
CREATE INDEX idx_attendance_sessions_status ON attendance_sessions(status);
CREATE INDEX idx_attendance_sessions_teacher_date ON attendance_sessions(teacher_id, session_date);
CREATE INDEX idx_attendance_sessions_class_date ON attendance_sessions(class_id, session_date);

-- Indexes for attendance_records
CREATE INDEX idx_attendance_records_session_id ON attendance_records(attendance_session_id);
CREATE INDEX idx_attendance_records_school_id ON attendance_records(school_id);
CREATE INDEX idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX idx_attendance_records_status ON attendance_records(status);
CREATE INDEX idx_attendance_records_source ON attendance_records(source);
CREATE INDEX idx_attendance_records_marked_by ON attendance_records(marked_by);
CREATE INDEX idx_attendance_records_student_date ON attendance_records(student_id, marked_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at trigger function (should already exist, but including for completeness)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_attendance_sessions_updated_at
  BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notify parents on absence/late trigger
CREATE OR REPLACE FUNCTION notify_parents_on_absence()
RETURNS TRIGGER AS $$
DECLARE
  student_record RECORD;
  parent_record RECORD;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Only trigger for new records or updates that change status to absent or late
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    IF NEW.status IN ('absent', 'late') THEN
      -- Get student information
      SELECT * INTO student_record
      FROM students
      WHERE id = NEW.student_id;

      -- Get planned session information for the session details
      DECLARE
        session_info RECORD;
      BEGIN
        SELECT
          ps.subject_name,
          ps.start_time,
          ps.end_time
        INTO session_info
        FROM planned_sessions ps
        INNER JOIN attendance_sessions att_s ON att_s.planned_session_id = ps.id
        WHERE att_s.id = NEW.attendance_session_id;

        -- Loop through parents and create notifications
        FOR parent_record IN
          SELECT u.id, u.first_name, u.notification_preferences
          FROM users u
          INNER JOIN student_parent_relations spr ON spr.parent_id = u.id
          WHERE spr.student_id = NEW.student_id
            AND u.is_active = true
        LOOP
          -- Build notification message
          notification_title := 'Absence de ' || COALESCE(student_record.first_name, 'Votre enfant');

          IF NEW.status = 'absent' THEN
            notification_body := 'Votre enfant ' || COALESCE(student_record.first_name, '') || ' ' || COALESCE(student_record.last_name, '') ||
                               ' a été marqué(e) absent(e) le ' || TO_CHAR(NEW.marked_at, 'DD/MM/YYYY') ||
                               CASE
                                 WHEN session_info.subject_name IS NOT NULL THEN
                                   ' pour ' || session_info.subject_name
                                 ELSE ''
                               END;
          ELSE -- late
            notification_body := 'Votre enfant ' || COALESCE(student_record.first_name, '') || ' ' || COALESCE(student_record.last_name, '') ||
                               ' a été marqué(e) en retard le ' || TO_CHAR(NEW.marked_at, 'DD/MM/YYYY') ||
                               CASE
                                 WHEN session_info.subject_name IS NOT NULL THEN
                                   ' pour ' || session_info.subject_name
                                 ELSE ''
                               END;
          END IF;

          -- Create notification
          INSERT INTO notifications (
            user_id,
            type,
            title,
            body,
            data,
            read_at,
            created_at
          ) VALUES (
            parent_record.id,
            'attendance_marked',
            notification_title,
            notification_body,
            jsonb_build_object(
              'studentId', NEW.student_id,
              'attendanceRecordId', NEW.id,
              'status', NEW.status,
              'sessionDate', NEW.marked_at::text,
              'sessionId', NEW.attendance_session_id
            ),
            NULL,
            NOW()
          );
        END LOOP;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply notification trigger
CREATE TRIGGER trigger_notify_parents_on_absence
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION notify_parents_on_absence();

COMMENT ON FUNCTION notify_parents_on_absence() IS 'Creates notifications for parents when a student is marked absent or late';
