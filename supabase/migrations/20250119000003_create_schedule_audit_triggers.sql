-- Migration: Create Audit Triggers for Schedule Tables
-- Description: Creates audit triggers for all schedule tables and validation triggers

-- ============================================
-- AUDIT TRIGGERS FOR SCHEDULE TABLES
-- ============================================

-- Audit trigger on schedules
CREATE TRIGGER audit_schedules
AFTER INSERT OR UPDATE OR DELETE ON schedules
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger on schedule_slots
CREATE TRIGGER audit_schedule_slots
AFTER INSERT OR UPDATE OR DELETE ON schedule_slots
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger on schedule_versions
CREATE TRIGGER audit_schedule_versions
AFTER INSERT ON schedule_versions
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger on schedule_constraints
CREATE TRIGGER audit_schedule_constraints
AFTER INSERT OR UPDATE OR DELETE ON schedule_constraints
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger on planned_sessions
CREATE TRIGGER audit_planned_sessions
AFTER UPDATE OR DELETE ON planned_sessions
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================
-- VALIDATION TRIGGERS
-- ============================================

-- Validate that teacher_id references a user with teacher role
CREATE OR REPLACE FUNCTION validate_schedule_slot_teacher()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = NEW.teacher_id
    AND r.name = 'teacher'
    AND user_roles.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Invalid teacher_id: user must have teacher role in the same school';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER schedule_slots_validate_teacher
  BEFORE INSERT OR UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION validate_schedule_slot_teacher();

-- Validate that class_id exists and belongs to the same school
CREATE OR REPLACE FUNCTION validate_schedule_slot_class()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM classes
    WHERE classes.id = NEW.class_id
    AND classes.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Invalid class_id: class must belong to the same school';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER schedule_slots_validate_class
  BEFORE INSERT OR UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION validate_schedule_slot_class();

-- Validate that subject_id exists and belongs to the same school
CREATE OR REPLACE FUNCTION validate_schedule_slot_subject()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM subjects
    WHERE subjects.id = NEW.subject_id
    AND subjects.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Invalid subject_id: subject must belong to the same school';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER schedule_slots_validate_subject
  BEFORE INSERT OR UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION validate_schedule_slot_subject();

-- Validate that room_id (if provided) exists and belongs to the same school
CREATE OR REPLACE FUNCTION validate_schedule_slot_room()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.room_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM rooms
      WHERE rooms.id = NEW.room_id
      AND rooms.school_id = NEW.school_id
    ) THEN
      RAISE EXCEPTION 'Invalid room_id: room must belong to the same school';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER schedule_slots_validate_room
  BEFORE INSERT OR UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION validate_schedule_slot_room();

-- Validate that schedule_id belongs to the same school
CREATE OR REPLACE FUNCTION validate_schedule_slot_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM schedules
    WHERE schedules.id = NEW.schedule_id
    AND schedules.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Invalid schedule_id: schedule must belong to the same school';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER schedule_slots_validate_schedule
  BEFORE INSERT OR UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION validate_schedule_slot_schedule();

-- ============================================
-- SPECIAL AUDIT FOR STATUS CHANGES
-- ============================================

-- Log schedule status changes separately for better tracking
CREATE OR REPLACE FUNCTION log_schedule_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM log_custom_action(
      'STATUS_CHANGE',
      'schedules',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'previous_version', OLD.version,
        'new_version', NEW.version,
        'published_at', NEW.published_at,
        'published_by', NEW.published_by
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER schedules_log_status_change
  AFTER INSERT OR UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_schedule_status_change();

-- ============================================
-- SPECIAL AUDIT FOR SESSION COMPLETION
-- ============================================

-- Log when planned sessions are marked as completed (for notebook integration)
CREATE OR REPLACE FUNCTION log_session_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if is_completed changed from false to true
  IF (TG_OP = 'UPDATE' AND OLD.is_completed = false AND NEW.is_completed = true) THEN
    PERFORM log_custom_action(
      'COMPLETE',
      'planned_sessions',
      NEW.id,
      jsonb_build_object(
        'session_date', NEW.session_date,
        'teacher_id', NEW.teacher_id,
        'class_id', NEW.class_id,
        'subject_id', NEW.subject_id,
        'completed_at', NOW()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER planned_sessions_log_completion
  AFTER UPDATE ON planned_sessions
  FOR EACH ROW
  EXECUTE FUNCTION log_session_completion();

-- ============================================
-- SPECIAL AUDIT FOR SESSION CANCELLATION
-- ============================================

-- Log when planned sessions are cancelled
CREATE OR REPLACE FUNCTION log_session_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if is_cancelled changed from false to true
  IF (TG_OP = 'UPDATE' AND OLD.is_cancelled = false AND NEW.is_cancelled = true) THEN
    PERFORM log_custom_action(
      'CANCEL',
      'planned_sessions',
      NEW.id,
      jsonb_build_object(
        'session_date', NEW.session_date,
        'teacher_id', NEW.teacher_id,
        'class_id', NEW.class_id,
        'subject_id', NEW.subject_id,
        'cancellation_reason', NEW.cancellation_reason,
        'cancelled_at', NOW()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER planned_sessions_log_cancellation
  AFTER UPDATE ON planned_sessions
  FOR EACH ROW
  EXECUTE FUNCTION log_session_cancellation();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION validate_schedule_slot_teacher() IS 'Validates that teacher_id references a user with teacher role in the same school';
COMMENT ON FUNCTION validate_schedule_slot_class() IS 'Validates that class_id exists and belongs to the same school';
COMMENT ON FUNCTION validate_schedule_slot_subject() IS 'Validates that subject_id exists and belongs to the same school';
COMMENT ON FUNCTION validate_schedule_slot_room() IS 'Validates that room_id (if provided) exists and belongs to the same school';
COMMENT ON FUNCTION validate_schedule_slot_schedule() IS 'Validates that schedule_id belongs to the same school';
COMMENT ON FUNCTION log_schedule_status_change() IS 'Logs schedule status changes (draft → published, etc.)';
COMMENT ON FUNCTION log_session_completion() IS 'Logs when planned sessions are marked as completed for notebook integration';
COMMENT ON FUNCTION log_session_cancellation() IS 'Logs when planned sessions are cancelled with reason';

COMMENT ON TRIGGER audit_schedules ON schedules IS 'Audit all changes to schedules';
COMMENT ON TRIGGER audit_schedule_slots ON schedule_slots IS 'Audit all changes to schedule slots';
COMMENT ON TRIGGER audit_schedule_versions ON schedule_versions IS 'Audit creation of schedule versions';
COMMENT ON TRIGGER audit_schedule_constraints ON schedule_constraints IS 'Audit all changes to schedule constraints';
COMMENT ON TRIGGER audit_planned_sessions ON planned_sessions IS 'Audit updates and deletes to planned sessions';
COMMENT ON TRIGGER schedule_slots_validate_teacher ON schedule_slots IS 'Validate teacher has teacher role in same school';
COMMENT ON TRIGGER schedule_slots_validate_class ON schedule_slots IS 'Validate class belongs to same school';
COMMENT ON TRIGGER schedule_slots_validate_subject ON schedule_slots IS 'Validate subject belongs to same school';
COMMENT ON TRIGGER schedule_slots_validate_room ON schedule_slots IS 'Validate room belongs to same school if provided';
COMMENT ON TRIGGER schedule_slots_validate_schedule ON schedule_slots IS 'Validate schedule belongs to same school';
COMMENT ON TRIGGER schedules_log_status_change ON schedules IS 'Log schedule status changes';
COMMENT ON TRIGGER planned_sessions_log_completion ON planned_sessions IS 'Log session completion events';
COMMENT ON TRIGGER planned_sessions_log_cancellation ON planned_sessions IS 'Log session cancellation events';
