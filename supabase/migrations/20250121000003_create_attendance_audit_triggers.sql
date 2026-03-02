-- Migration: Audit Triggers for Attendance Tables
-- Description: Creates audit logging for attendance_sessions and attendance_records
-- Created: 2025-01-21

-- This migration assumes the audit_logs table exists with the following structure:
-- - id (UUID, PK)
-- - table_name (TEXT)
-- - record_id (UUID)
-- - action (TEXT) - 'INSERT', 'UPDATE', 'DELETE'
-- - old_data (JSONB)
-- - new_data (JSONB)
-- - changed_by (UUID)
-- - changed_at (TIMESTAMPTZ)
-- - school_id (UUID)

-- ============================================================================
-- AUDIT FUNCTIONS
-- ============================================================================

-- Audit function for attendance_sessions
CREATE OR REPLACE FUNCTION audit_attendance_sessions()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_uuid UUID;
BEGIN
  -- Get the current user from auth.uid()
  user_id := auth.uid();

  -- Get school_id from the record
  IF TG_OP = 'DELETE' THEN
    school_uuid := OLD.school_id;
  ELSE
    school_uuid := NEW.school_id;
  END IF;

  -- Log the action
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      NEW.id,
      'INSERT',
      NULL::jsonb,
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL::jsonb,
      user_id,
      NOW(),
      school_uuid
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Audit function for attendance_records
CREATE OR REPLACE FUNCTION audit_attendance_records()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  school_uuid UUID;
BEGIN
  -- Get the current user from auth.uid()
  user_id := auth.uid();

  -- Get school_id from the record
  IF TG_OP = 'DELETE' THEN
    school_uuid := OLD.school_id;
  ELSE
    school_uuid := NEW.school_id;
  END IF;

  -- Log the action
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_records',
      NEW.id,
      'INSERT',
      NULL::jsonb,
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_records',
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      user_id,
      NOW(),
      school_uuid
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_records',
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL::jsonb,
      user_id,
      NOW(),
      school_uuid
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Create triggers for attendance_sessions
CREATE TRIGGER audit_attendance_sessions_insert
  AFTER INSERT ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_sessions();

CREATE TRIGGER audit_attendance_sessions_update
  AFTER UPDATE ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_sessions();

CREATE TRIGGER audit_attendance_sessions_delete
  AFTER DELETE ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_sessions();

-- Create triggers for attendance_records
CREATE TRIGGER audit_attendance_records_insert
  AFTER INSERT ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_records();

CREATE TRIGGER audit_attendance_records_update
  AFTER UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_records();

CREATE TRIGGER audit_attendance_records_delete
  AFTER DELETE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION audit_attendance_records();

-- ============================================================================
-- AUDIT FUNCTIONS FOR STATUS CHANGES
-- ============================================================================

-- Special audit function for attendance session status changes (draft -> submitted -> validated)
CREATE OR REPLACE FUNCTION audit_attendance_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      changed_at,
      school_id
    ) VALUES (
      'attendance_sessions',
      NEW.id,
      'STATUS_CHANGE',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      to_jsonb(NEW),
      auth.uid(),
      NOW(),
      NEW.school_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply status change trigger
CREATE TRIGGER audit_attendance_session_status_change
  AFTER UPDATE ON attendance_sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION audit_attendance_session_status_change();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION audit_attendance_sessions() IS 'Logs all changes to attendance_sessions table';
COMMENT ON FUNCTION audit_attendance_records() IS 'Logs all changes to attendance_records table';
COMMENT ON FUNCTION audit_attendance_session_status_change() IS 'Logs status changes in attendance_sessions workflow';
