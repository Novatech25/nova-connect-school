-- Migration: Fix notify_teacher_on_validation to remove non-existent channels column

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
