-- Migration: Fix payroll notification triggers that reference non-existent 'priority' column
-- The notifications table does not have a 'priority' column.
-- This migration corrects both notify_teacher_hours_validated and notify_teacher_payment_recorded functions.

-- Fix 1: Notify teacher when lesson hours are validated
CREATE OR REPLACE FUNCTION notify_teacher_hours_validated()
RETURNS TRIGGER AS $$
DECLARE
  class_name TEXT;
  subject_name TEXT;
  school_id_val UUID;
BEGIN
  -- Only trigger when status changes to 'validated'
  IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN
    -- Get class, subject, and school names
    SELECT c.name, l.school_id INTO class_name, school_id_val
    FROM classes c
    JOIN lesson_logs l ON l.class_id = c.id
    WHERE l.id = NEW.id;

    SELECT s.name INTO subject_name
    FROM subjects s
    WHERE s.id = NEW.subject_id;

    -- Insert notification WITHOUT the 'priority' column (does not exist)
    INSERT INTO notifications (
      school_id,
      user_id,
      type,
      title,
      body,
      data,
      channels,
      read_at,
      sent_at,
      created_at
    ) VALUES (
      school_id_val,
      NEW.teacher_id,
      'hours_validated',
      'Heures validées',
      format(
        'Vos heures du %s ont été validées (%.2fh)',
        to_char(NEW.session_date, 'DD/MM/YYYY'),
        (NEW.duration_minutes::decimal / 60)
      ),
      jsonb_build_object(
        'lessonLogId', NEW.id,
        'duration', NEW.duration_minutes,
        'className', class_name,
        'subjectName', subject_name,
        'sessionDate', NEW.session_date
      ),
      ARRAY['in_app', 'push'],
      NULL,
      now(),
      now()
    );

    -- Call the push notification edge function (best-effort, ignore errors)
    BEGIN
      PERFORM net.http_post(
        url := format('%s/functions/v1/send-payroll-notification', current_setting('app.supabase_url', true)),
        headers := jsonb_build_object(
          'Authorization', format('Bearer %s', current_setting('app.service_role_key', true)),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'teacherId', NEW.teacher_id,
          'title', 'Heures validées',
          'message', format('Vos heures du %s ont été validées (%.2fh)', to_char(NEW.session_date, 'DD/MM/YYYY'), (NEW.duration_minutes::decimal / 60)),
          'data', jsonb_build_object(
            'type', 'hours_validated',
            'lessonLogId', NEW.id
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ignore errors from push notification (optional dependency)
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS notify_teacher_hours_validated_trigger ON lesson_logs;
CREATE TRIGGER notify_teacher_hours_validated_trigger
  AFTER INSERT OR UPDATE ON lesson_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_hours_validated();


-- Fix 2: Notify teacher when payment is recorded
CREATE OR REPLACE FUNCTION notify_teacher_payment_recorded()
RETURNS TRIGGER AS $$
DECLARE
  teacher_info RECORD;
BEGIN
  -- Get teacher, period, and school information
  SELECT
    pe.teacher_id,
    pe.school_id,
    pp.period_name
  INTO teacher_info
  FROM payroll_entries pe
  JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
  WHERE pe.id = NEW.payroll_entry_id;

  IF teacher_info IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification WITHOUT the 'priority' column (does not exist)
  INSERT INTO notifications (
    school_id,
    user_id,
    type,
    title,
    body,
    data,
    channels,
    read_at,
    sent_at,
    created_at
  ) VALUES (
    teacher_info.school_id,
    teacher_info.teacher_id,
    'payroll_payment',
    'Paiement effectué',
    format(
      'Un paiement de %s FCFA a été enregistré pour la période %s',
      to_char(NEW.amount, 'FM999,999,999'),
      teacher_info.period_name
    ),
    jsonb_build_object(
      'paymentId', NEW.id,
      'amount', NEW.amount,
      'paymentMethod', NEW.payment_method,
      'periodName', teacher_info.period_name,
      'paymentDate', NEW.payment_date
    ),
    ARRAY['in_app', 'push'],
    NULL,
    now(),
    now()
  );

  -- Call the push notification edge function (best-effort, ignore errors)
  BEGIN
    PERFORM net.http_post(
      url := format('%s/functions/v1/send-payroll-notification', current_setting('app.supabase_url', true)),
      headers := jsonb_build_object(
        'Authorization', format('Bearer %s', current_setting('app.service_role_key', true)),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'teacherId', teacher_info.teacher_id,
        'title', 'Paiement effectué',
        'message', format(
          'Un paiement de %s FCFA a été enregistré pour la période %s',
          to_char(NEW.amount, 'FM999,999,999'),
          teacher_info.period_name
        ),
        'data', jsonb_build_object(
          'type', 'payroll_payment',
          'paymentId', NEW.id
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS notify_teacher_payment_recorded_trigger ON payroll_payments;
CREATE TRIGGER notify_teacher_payment_recorded_trigger
  AFTER INSERT ON payroll_payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_payment_recorded();
