-- Migration: Fix Lesson Logs Audit Triggers
-- Description: Updates lesson_logs audit triggers to use log_audit_event to avoid old schema column errors (resource_type, old_data, new_data)

-- 1. Function: Audit lesson log changes
CREATE OR REPLACE FUNCTION audit_lesson_log_changes()
RETURNS TRIGGER AS $$
DECLARE
  action_value TEXT;
  description_value TEXT;
BEGIN
  -- Determine action based on operation
  IF (TG_OP = 'INSERT') THEN
    action_value := 'create';
    description_value := 'Created lesson log for session date: ' || NEW.session_date;
    PERFORM log_audit_event('lesson_log', NEW.id, action_value, 'lesson_logs', description_value, NEW.school_id);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    action_value := 'update';
    
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      description_value := 'Status changed: ' || OLD.status || ' → ' || NEW.status;
    ELSE
      description_value := 'Updated lesson log';
    END IF;
    
    PERFORM log_audit_event('lesson_log', NEW.id, action_value, 'lesson_logs', description_value, NEW.school_id);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    action_value := 'delete';
    description_value := 'Deleted lesson log';
    PERFORM log_audit_event('lesson_log', OLD.id, action_value, 'lesson_logs', description_value, OLD.school_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Function: Mark planned session as completed
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

    -- Log this action
    PERFORM log_audit_event(
      'planned_session', 
      NEW.planned_session_id, 
      'update', 
      'planned_sessions', 
      'Marked as completed after lesson log validation', 
      NEW.school_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Function: Notify teacher on validation
CREATE OR REPLACE FUNCTION notify_teacher_on_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when status changes to validated or rejected
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('validated', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Create notification for the teacher
    INSERT INTO notifications (
      school_id,
      user_id,
      type,
      title,
      body,
      data,
      channels,
      read_at,
      created_at
    )
    VALUES (
      NEW.school_id,
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
      ARRAY['in_app', 'push'], -- default channels
      NULL,
      NOW()
    );

    -- Log notification creation
    PERFORM log_audit_event(
      'notification',
      NEW.teacher_id,
      'create',
      'notifications',
      'Teacher notified of lesson log ' || NEW.status,
      NEW.school_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
