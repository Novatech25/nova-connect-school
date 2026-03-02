-- Migration: Add attendance fusion fields
-- This migration adds fields to support merging teacher manual attendance with QR scans
-- Date: 2025-01-23

-- ============================================================================
-- 1. Create enums for record status
-- ============================================================================

-- Create enum for attendance record status
CREATE TYPE attendance_record_status_enum AS ENUM (
  'auto',        -- QR scan only (no teacher intervention)
  'confirmed',   -- Both sources agree (teacher confirmed QR)
  'overridden',  -- Teacher overrode the QR scan or vice versa
  'manual'       -- Teacher manual only (no QR scan)
);

-- COMMENT ON TYPE
COMMENT ON TYPE attendance_record_status_enum IS 'Status of how the attendance record was created: auto (QR only), confirmed (both sources agree), overridden (one source overrode the other), manual (teacher only)';

-- ============================================================================
-- 2. Add fusion fields to attendance_records table
-- ============================================================================

-- Add record_status column
ALTER TABLE attendance_records
  ADD COLUMN record_status attendance_record_status_enum NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN attendance_records.record_status IS 'Status of the record: auto = QR scan only, confirmed = both sources agree, overridden = one source overrode the other, manual = teacher only';

-- Add original_source column to track the source before fusion
ALTER TABLE attendance_records
  ADD COLUMN original_source attendance_source_enum NULL;

COMMENT ON COLUMN attendance_records.original_source IS 'The original source before fusion (e.g., qr_scan if teacher overrode a QR scan)';

-- Add merged_at timestamp
ALTER TABLE attendance_records
  ADD COLUMN merged_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN attendance_records.merged_at IS 'Timestamp when this record was merged from multiple sources';

-- Add merged_by user reference
ALTER TABLE attendance_records
  ADD COLUMN merged_by UUID NULL REFERENCES users(id);

COMMENT ON COLUMN attendance_records.merged_by IS 'User who performed the merge operation';

-- Add constraint: if record_status is 'overridden', original_source must be set
ALTER TABLE attendance_records
  ADD CONSTRAINT check_overridden_has_original_source
  CHECK (
    NOT (record_status = 'overridden' AND original_source IS NULL)
  );

COMMENT ON CONSTRAINT check_overridden_has_original_source ON attendance_records IS
  'Ensure that overridden records have an original_source specified';

-- ============================================================================
-- 3. Create attendance_record_history table
-- ============================================================================

CREATE TABLE attendance_record_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status attendance_status_enum NOT NULL,
  source attendance_source_enum NOT NULL,
  record_status attendance_record_status_enum NOT NULL,
  justification TEXT,
  comment TEXT,
  marked_by UUID NOT NULL REFERENCES users(id),
  marked_at TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'merged', 'overridden')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE attendance_record_history IS 'Audit trail of all changes to attendance records, including merges and overrides';
COMMENT ON COLUMN attendance_record_history.attendance_record_id IS 'Reference to the current attendance record';
COMMENT ON COLUMN attendance_record_history.action IS 'Type of action: created, updated, merged (sources combined), overridden (one source replaced another)';
COMMENT ON COLUMN attendance_record_history.metadata IS 'Additional information about the change (e.g., merge strategy, conflict details)';

-- ============================================================================
-- 4. Create indexes on attendance_record_history
-- ============================================================================

-- Index for looking up history by record
CREATE INDEX idx_attendance_record_history_record_id
  ON attendance_record_history(attendance_record_id);

-- Index for looking up history by student
CREATE INDEX idx_attendance_record_history_student_id
  ON attendance_record_history(student_id);

-- Index for ordering by creation time
CREATE INDEX idx_attendance_record_history_created_at
  ON attendance_record_history(created_at DESC);

-- Index for school-based queries
CREATE INDEX idx_attendance_record_history_school_id
  ON attendance_record_history(school_id);

-- Composite index for school + date queries
CREATE INDEX idx_attendance_record_history_school_created
  ON attendance_record_history(school_id, created_at DESC);

-- ============================================================================
-- 5. Create trigger to auto-log changes to attendance_record_history
-- ============================================================================

-- Function to log attendance record changes
CREATE OR REPLACE FUNCTION log_attendance_record_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET row_security = off
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO attendance_record_history (
      attendance_record_id,
      school_id,
      student_id,
      status,
      source,
      record_status,
      justification,
      comment,
      marked_by,
      marked_at,
      action,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      NEW.school_id,
      NEW.student_id,
      NEW.status,
      NEW.source,
      NEW.record_status,
      NEW.justification,
      NEW.comment,
      NEW.marked_by,
      NEW.marked_at,
      'created',
      NEW.metadata,
      NOW()
    );
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Determine the action based on what changed
    DECLARE
      action_type TEXT := 'updated';
    BEGIN
      -- If record_status changed to 'overridden' or 'confirmed', it's a merge
      IF NEW.record_status IN ('confirmed', 'overridden')
         AND OLD.record_status != NEW.record_status THEN
        action_type := 'merged';
      END IF;

      -- If original_source changed, it's an override
      IF COALESCE(OLD.original_source, '') != COALESCE(NEW.original_source, '') THEN
        action_type := 'overridden';
      END IF;

      INSERT INTO attendance_record_history (
        attendance_record_id,
        school_id,
        student_id,
        status,
        source,
        record_status,
        justification,
        comment,
        marked_by,
        marked_at,
        action,
        metadata,
        created_at
      ) VALUES (
        NEW.id,
        NEW.school_id,
        NEW.student_id,
        NEW.status,
        NEW.source,
        NEW.record_status,
        NEW.justification,
        NEW.comment,
        NEW.marked_by,
        NEW.marked_at,
        action_type,
        jsonb_build_object(
          'previous_status', OLD.status,
          'previous_source', OLD.source,
          'previous_record_status', OLD.record_status,
          'previous_original_source', OLD.original_source,
          'merged_at', NEW.merged_at,
          'merged_by', NEW.merged_by
        ) || NEW.metadata,
        NOW()
      );

      RETURN NEW;
    END;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_attendance_record_changes() IS
  'Automatically logs all INSERT and UPDATE operations on attendance_records to the history table';

-- Create trigger
CREATE TRIGGER attendance_record_changes_trigger
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION log_attendance_record_changes();

COMMENT ON TRIGGER attendance_record_changes_trigger ON attendance_records IS
  'Logs all changes to attendance records for audit and conflict resolution';

-- ============================================================================
-- 6. Update existing records to have appropriate record_status
-- ============================================================================

-- Set record_status based on existing data
UPDATE attendance_records
SET record_status = CASE
  WHEN source = 'qr_scan' THEN 'auto'::attendance_record_status_enumattendance_record_status_enumattendance_record_status_enum
  WHEN source = 'teacher_manual' THEN 'manual'::attendance_record_status_enumattendance_record_status_enumattendance_record_status_enum
  ELSE 'manual'::attendance_record_status_enumattendance_record_status_enumattendance_record_status_enum
END
WHERE record_status = 'manual'::attendance_record_status_enumattendance_record_status_enumattendance_record_status_enum; -- Only update the default

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

-- Grant access to attendance_record_history
GRANT SELECT ON attendance_record_history TO authenticated;
GRANT INSERT ON attendance_record_history TO authenticated;
GRANT UPDATE ON attendance_record_history TO service_role;

-- Grant usage on enum types
GRANT USAGE ON TYPE attendance_record_status_enum TO authenticated;
GRANT USAGE ON TYPE attendance_record_status_enum TO service_role;
