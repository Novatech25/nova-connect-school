-- Migration: Fix format() specifier error in payroll notification triggers
-- PostgreSQL format() only supports %s, %I, %L — NOT %.2f
-- Use round() to format decimal numbers instead.

CREATE OR REPLACE FUNCTION notify_teacher_hours_validated()
RETURNS TRIGGER AS $$
DECLARE
  class_name TEXT;
  subject_name TEXT;
  school_id_val UUID;
  hours_text TEXT;
BEGIN
  IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN
    SELECT c.name, l.school_id INTO class_name, school_id_val
    FROM classes c
    JOIN lesson_logs l ON l.class_id = c.id
    WHERE l.id = NEW.id;

    SELECT s.name INTO subject_name
    FROM subjects s WHERE s.id = NEW.subject_id;

    -- Format hours as text using round() — no %.2f in pg format()
    hours_text := round(NEW.duration_minutes::decimal / 60, 2)::text;

    INSERT INTO notifications (school_id, user_id, type, title, body, data, read_at, created_at)
    VALUES (
      school_id_val,
      NEW.teacher_id,
      'hours_validated',
      'Heures validées',
      'Vos heures du ' || to_char(NEW.session_date, 'DD/MM/YYYY') || ' ont été validées (' || hours_text || 'h)',
      jsonb_build_object(
        'lessonLogId', NEW.id,
        'duration', NEW.duration_minutes,
        'className', class_name,
        'subjectName', subject_name,
        'sessionDate', NEW.session_date
      ),
      NULL,
      now()
    );

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
          'message', 'Vos heures du ' || to_char(NEW.session_date, 'DD/MM/YYYY') || ' ont été validées (' || hours_text || 'h)',
          'data', jsonb_build_object('type', 'hours_validated', 'lessonLogId', NEW.id)
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_teacher_hours_validated_trigger ON lesson_logs;
CREATE TRIGGER notify_teacher_hours_validated_trigger
  AFTER INSERT OR UPDATE ON lesson_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_hours_validated();


CREATE OR REPLACE FUNCTION notify_teacher_payment_recorded()
RETURNS TRIGGER AS $$
DECLARE
  teacher_info RECORD;
  amount_text TEXT;
BEGIN
  SELECT pe.teacher_id, pe.school_id, pp.period_name
  INTO teacher_info
  FROM payroll_entries pe
  JOIN payroll_periods pp ON pp.id = pe.payroll_period_id
  WHERE pe.id = NEW.payroll_entry_id;

  IF teacher_info IS NULL OR teacher_info.teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  amount_text := to_char(NEW.amount, 'FM999G999G999');

  INSERT INTO notifications (school_id, user_id, type, title, body, data, read_at, created_at)
  VALUES (
    teacher_info.school_id,
    teacher_info.teacher_id,
    'payroll_payment',
    'Paiement effectué',
    'Un paiement de ' || amount_text || ' FCFA a été enregistré pour la période ' || teacher_info.period_name,
    jsonb_build_object(
      'paymentId', NEW.id,
      'amount', NEW.amount,
      'paymentMethod', NEW.payment_method,
      'periodName', teacher_info.period_name,
      'paymentDate', NEW.payment_date
    ),
    NULL,
    now()
  );

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
        'message', 'Un paiement de ' || amount_text || ' FCFA a été enregistré pour la période ' || teacher_info.period_name,
        'data', jsonb_build_object('type', 'payroll_payment', 'paymentId', NEW.id)
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_teacher_payment_recorded_trigger ON payroll_payments;
CREATE TRIGGER notify_teacher_payment_recorded_trigger
  AFTER INSERT ON payroll_payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_payment_recorded();
