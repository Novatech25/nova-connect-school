-- =====================================================
-- Migration: Create audit triggers for lesson_logs
-- Description: Audit logging, planned session completion, and notifications
-- =====================================================

-- =====================================================
-- Function: Audit lesson log changes
-- =====================================================

CREATE OR REPLACE FUNCTION audit_lesson_log_changes()
RETURNS TRIGGER AS $$
DECLARE
  action_value audit_action_enum;
  old_data_value JSONB;
  new_data_value JSONB;
BEGIN
  -- Determine action based on operation
  IF (TG_OP = 'INSERT') THEN
    action_value := 'INSERT';
    new_data_value := jsonb_build_object(
      'lesson_log_id', NEW.id,
      'planned_session_id', NEW.planned_session_id,
      'teacher_id', NEW.teacher_id,
      'class_id', NEW.class_id,
      'subject_id', NEW.subject_id,
      'session_date', NEW.session_date,
      'theme', NEW.theme,
      'duration_minutes', NEW.duration_minutes,
      'status', NEW.status,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude
    );

  ELSIF (TG_OP = 'UPDATE') THEN
    action_value := 'UPDATE';

    -- Build old_data from significant changes
    old_data_value := jsonb_build_object(
      'lesson_log_id', OLD.id,
      'previous_status', OLD.status
    );

    -- Build new_data with current state
    new_data_value := jsonb_build_object(
      'lesson_log_id', NEW.id,
      'new_status', NEW.status
    );

    -- Add specific fields based on what changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      new_data_value := new_data_value || jsonb_build_object(
        'status_change', jsonb_build_object(
          'from', OLD.status,
          'to', NEW.status,
          'event', CASE
            WHEN NEW.status = 'pending_validation' AND OLD.status = 'draft' THEN 'submitted'
            WHEN NEW.status = 'validated' THEN 'validated'
            WHEN NEW.status = 'rejected' THEN 'rejected'
            ELSE 'changed'
          END
        )
      );
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    action_value := 'DELETE';
    old_data_value := jsonb_build_object(
      'lesson_log_id', OLD.id,
      'teacher_id', OLD.teacher_id,
      'planned_session_id', OLD.planned_session_id,
      'status', OLD.status
    );
  END IF;

  -- Insert audit log with correct columns
  INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, old_data, new_data)
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    COALESCE(NEW.teacher_id, OLD.teacher_id, auth.uid()),
    action_value,
    'lesson_log',
    COALESCE(NEW.id, OLD.id),
    old_data_value,
    new_data_value
  );

  -- Return appropriate value based on operation
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Mark planned session as completed
-- =====================================================

CREATE OR REPLACE FUNCTION mark_planned_session_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only mark as completed when status changes to 'validated'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'validated' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Update the planned session to mark it as completed
    UPDATE planned_sessions
    SET is_completed = true,
        updated_at = NOW()
    WHERE id = NEW.planned_session_id;

    -- Log this action with correct audit_logs columns
    INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, new_data)
    VALUES (
      NEW.school_id,
      NEW.validated_by,
      'UPDATE',
      'planned_session',
      NEW.planned_session_id,
      jsonb_build_object(
        'lesson_log_id', NEW.id,
        'teacher_id', NEW.teacher_id,
        'validated_by', NEW.validated_by,
        'validated_at', NEW.validated_at,
        'is_completed', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Notify teacher on validation
-- =====================================================

CREATE OR REPLACE FUNCTION notify_teacher_on_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when status changes to validated or rejected
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('validated', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Create notification for the teacher
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_at
    )
    VALUES (
      NEW.teacher_id,
      CASE
        WHEN NEW.status = 'validated' THEN 'lesson_log_validated'
        WHEN NEW.status = 'rejected' THEN 'lesson_log_rejected'
      END,
      CASE
        WHEN NEW.status = 'validated' THEN 'Cahier de texte validé'
        WHEN NEW.status = 'rejected' THEN 'Cahier de texte rejeté'
      END,
      CASE
        WHEN NEW.status = 'validated' THEN
          'Votre cahier de texte pour la séance du ' || TO_CHAR(NEW.session_date, 'DD/MM/YYYY') || ' a été validé.'
        WHEN NEW.status = 'rejected' THEN
          'Votre cahier de texte pour la séance du ' || TO_CHAR(NEW.session_date, 'DD/MM/YYYY') || ' a été rejeté. ' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN
            'Raison: ' || NEW.rejection_reason
          ELSE
            'Veuillez le corriger et le resoumettre.'
          END
      END,
      jsonb_build_object(
        'lesson_log_id', NEW.id,
        'planned_session_id', NEW.planned_session_id,
        'class_id', NEW.class_id,
        'subject_id', NEW.subject_id,
        'session_date', TO_CHAR(NEW.session_date, 'YYYY-MM-DD'),
        'theme', NEW.theme,
        'status', NEW.status,
        'rejection_reason', NEW.rejection_reason
      ),
      NOW()
    );

    -- Log notification creation with correct audit_logs columns
    INSERT INTO audit_logs (school_id, user_id, action, resource_type, resource_id, new_data)
    VALUES (
      NEW.school_id,
      NEW.validated_by,
      'INSERT',
      'notification',
      NEW.teacher_id,
      jsonb_build_object(
        'lesson_log_id', NEW.id,
        'notification_type', CASE
          WHEN NEW.status = 'validated' THEN 'lesson_log_validated'
          WHEN NEW.status = 'rejected' THEN 'lesson_log_rejected'
        END
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Apply triggers to lesson_logs table
-- =====================================================

-- Audit trigger (INSERT, UPDATE, DELETE)
CREATE TRIGGER lesson_logs_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON lesson_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_lesson_log_changes();

-- Mark planned session completed trigger (UPDATE)
CREATE TRIGGER lesson_logs_mark_completed_trigger
  AFTER UPDATE ON lesson_logs
  FOR EACH ROW
  EXECUTE FUNCTION mark_planned_session_completed();

-- Notify teacher on validation trigger (UPDATE)
CREATE TRIGGER lesson_logs_notify_teacher_trigger
  AFTER UPDATE ON lesson_logs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('validated', 'rejected'))
  EXECUTE FUNCTION notify_teacher_on_validation();

-- =====================================================
-- Comments on functions and triggers
-- =====================================================

COMMENT ON FUNCTION audit_lesson_log_changes() IS 'Audits all changes to lesson_logs (create, update, submit, validate, reject, delete)';
COMMENT ON FUNCTION mark_planned_session_completed() IS 'Automatically marks a planned session as completed when its lesson log is validated';
COMMENT ON FUNCTION notify_teacher_on_validation() IS 'Sends a notification to the teacher when their lesson log is validated or rejected';

COMMENT ON TRIGGER lesson_logs_audit_trigger ON lesson_logs IS 'Audit all changes to lesson logs';
COMMENT ON TRIGGER lesson_logs_mark_completed_trigger ON lesson_logs IS 'Mark planned session as completed upon validation';
COMMENT ON TRIGGER lesson_logs_notify_teacher_trigger ON lesson_logs IS 'Notify teacher of validation or rejection';
