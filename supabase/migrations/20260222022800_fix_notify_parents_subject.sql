-- Migration: Fix Attendance Notifications Subject Name
-- Description: Updates the notify_parents_on_absence trigger to correctly join the subjects table instead of using ps.subject_name

CREATE OR REPLACE FUNCTION notify_parents_on_absence()
RETURNS TRIGGER AS $$
DECLARE
  student_record RECORD;
  parent_record RECORD;
  notification_title TEXT;
  notification_body TEXT;
  session_info RECORD;
  v_session_date DATE;
BEGIN
  -- Only trigger for new records or updates that change status to absent or late
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status)) THEN
    IF NEW.status IN ('absent', 'late') THEN
      -- Get student information
      SELECT * INTO student_record
      FROM students
      WHERE id = NEW.student_id;

      -- Get session date from attendance_sessions
      SELECT session_date INTO v_session_date
      FROM attendance_sessions
      WHERE id = NEW.attendance_session_id;

      -- Get planned session information for the session details (joining subjects)
      SELECT
        sub.name as subject_name,
        ps.start_time,
        ps.end_time
      INTO session_info
      FROM planned_sessions ps
      INNER JOIN attendance_sessions att_s ON att_s.planned_session_id = ps.id
      LEFT JOIN subjects sub ON sub.id = ps.subject_id
      WHERE att_s.id = NEW.attendance_session_id;

      -- Loop through parents and create notifications
      FOR parent_record IN
        SELECT u.id, u.first_name, u.email, u.phone
        FROM users u
        INNER JOIN student_parent_relations spr ON spr.parent_id = u.id
        WHERE spr.student_id = NEW.student_id
          AND u.is_active = true
      LOOP
        -- Build notification message
        notification_title := CASE 
          WHEN NEW.status = 'absent' THEN 'Absence de ' || COALESCE(student_record.first_name, 'votre enfant')
          ELSE 'Retard de ' || COALESCE(student_record.first_name, 'votre enfant')
        END;

        notification_body := CASE
          WHEN NEW.status = 'absent' THEN 
            'Votre enfant ' || COALESCE(student_record.first_name, '') || ' ' || COALESCE(student_record.last_name, '') ||
            ' a été marqué(e) absent(e) le ' || TO_CHAR(v_session_date, 'DD/MM/YYYY') ||
            CASE WHEN session_info.subject_name IS NOT NULL THEN ' pour ' || session_info.subject_name ELSE '' END
          ELSE 
            'Votre enfant ' || COALESCE(student_record.first_name, '') || ' ' || COALESCE(student_record.last_name, '') ||
            ' a été marqué(e) en retard le ' || TO_CHAR(v_session_date, 'DD/MM/YYYY') ||
            CASE WHEN session_info.subject_name IS NOT NULL THEN ' pour ' || session_info.subject_name ELSE '' END
        END;

        -- Create notification in-app
        INSERT INTO notifications (
          user_id,
          type,
          title,
          body,
          data,
          channels,
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
            'sessionDate', v_session_date::text,
            'sessionId', NEW.attendance_session_id,
            'subjectName', session_info.subject_name
          ),
          ARRAY['in_app', 'push'], -- Canaux par défaut
          NULL,
          NOW()
        );
      END LOOP;

      -- Appeler l'Edge Function pour les notifications push/email/SMS
      -- Cette partie est asynchrone et ne bloque pas la transaction
      BEGIN
        PERFORM call_attendance_edge_function(
          NEW.student_id,
          NEW.id,
          NEW.status::text,
          NEW.attendance_session_id,
          v_session_date::text
        );
      EXCEPTION WHEN OTHERS THEN
        -- Ne pas bloquer si l'appel échoue
        RAISE WARNING 'Edge function call failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
