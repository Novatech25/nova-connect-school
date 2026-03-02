-- ============================================================================
-- Payroll Notification Triggers
-- Creates triggers to automatically notify teachers when hours are validated
-- and when payments are recorded
-- ============================================================================

-- Add payroll notification types to the enum
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'hours_validated';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'payroll_payment';

-- Trigger: Notify teacher when lesson hours are validated
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

    -- Insert notification with correct schema
    INSERT INTO notifications (
      school_id,
      user_id,
      type,
      title,
      body,
      data,
      priority,
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
      'normal',
      ARRAY['in_app', 'push'],
      NULL,
      now(),
      now()
    );

    -- Call the push notification edge function (if it exists)
    -- This is done via pg_net or directly if the function is callable
    PERFORM net.http_post(
      url := format('%s/functions/v1/send-payroll-notification', current_setting('app.supabase_url')),
      headers := jsonb_build_object(
        'Authorization', format('Bearer %s', current_setting('app.service_role_key')),
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_teacher_hours_validated_trigger ON lesson_logs;
CREATE TRIGGER notify_teacher_hours_validated_trigger
  AFTER INSERT OR UPDATE ON lesson_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_hours_validated();


-- Trigger: Notify teacher when payment is recorded
CREATE OR REPLACE FUNCTION notify_teacher_payment_recorded()
RETURNS TRIGGER AS $$
DECLARE
  teacher_info RECORD;
  period_info RECORD;
  school_id_val UUID;
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

  -- Insert notification with correct schema
  INSERT INTO notifications (
    school_id,
    user_id,
    type,
    title,
    body,
    data,
    priority,
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
    'normal',
    ARRAY['in_app', 'push'],
    NULL,
    now(),
    now()
  );

  -- Call the push notification edge function
  PERFORM net.http_post(
    url := format('%s/functions/v1/send-payroll-notification', current_setting('app.supabase_url')),
    headers := jsonb_build_object(
      'Authorization', format('Bearer %s', current_setting('app.service_role_key')),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'teacherId', teacher_info.teacher_id,
      'title', 'Paiement effectué',
      'message', format('Un paiement de %s FCFA a été enregistré', to_char(NEW.amount, 'FM999,999,999')),
      'data', jsonb_build_object(
        'type', 'payroll_payment',
        'paymentId', NEW.id
      )
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notify_teacher_payment_recorded_trigger ON payroll_payments;
CREATE TRIGGER notify_teacher_payment_recorded_trigger
  AFTER INSERT ON payroll_payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_payment_recorded();


-- Add comments for documentation
COMMENT ON FUNCTION notify_teacher_hours_validated() IS 'Automatically creates notifications when teacher lesson hours are validated';
COMMENT ON FUNCTION notify_teacher_payment_recorded() IS 'Automatically creates notifications when payroll payments are recorded';
COMMENT ON TRIGGER notify_teacher_hours_validated_trigger ON lesson_logs IS 'Trigger for notifying teachers of validated hours';
COMMENT ON TRIGGER notify_teacher_payment_recorded_trigger ON payroll_payments IS 'Trigger for notifying teachers of recorded payments';
