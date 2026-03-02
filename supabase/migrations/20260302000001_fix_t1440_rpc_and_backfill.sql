-- Migration: Add T-1440 notifications and notify students/parents on publish
-- Schéma réel vérifié:
--   enrollments (student_id, class_id, status)
--   student_parent_relations (student_id, parent_id) -> parents (user_id)
--   notifications (user_id, school_id, type, title, body, data)

ALTER TABLE public.room_assignments
ADD COLUMN IF NOT EXISTS t1440_sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_room_assignments_t1440_sent ON public.room_assignments(t1440_sent_at) WHERE t1440_sent_at IS NULL;

-- ===========================================================
-- 1. RPC: Rappels automatiques (T-1440, T-60, T-15)
-- ===========================================================
DROP FUNCTION IF EXISTS public.send_room_assignment_notifications_rpc(INTEGER, DATE);

CREATE OR REPLACE FUNCTION public.send_room_assignment_notifications_rpc(
  p_notification_window INTEGER,
  p_session_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 0;
  v_assignment RECORD;
  v_time_from TIME;
  v_time_to TIME;
  v_target_date DATE;
  v_title TEXT;
BEGIN
  -- Date cible: J+1 pour T-1440, aujourd'hui sinon
  IF p_notification_window >= 1440 THEN
    v_target_date := COALESCE(p_session_date, CURRENT_DATE + INTERVAL '1 day');
  ELSE
    v_target_date := COALESCE(p_session_date, CURRENT_DATE);
  END IF;

  -- Fenêtre horaire pour T-60 et T-15 seulement
  IF p_notification_window < 1440 THEN
    v_time_from := (CURRENT_TIME + (p_notification_window - 5) * INTERVAL '1 minute')::TIME;
    v_time_to   := (CURRENT_TIME + (p_notification_window + 5) * INTERVAL '1 minute')::TIME;
  END IF;

  IF p_notification_window >= 1440 THEN
    v_title := '📅 Prévu: Cours de demain';
  ELSIF p_notification_window = 60 THEN
    v_title := '🔔 Rappel: Cours dans 1 heure';
  ELSE
    v_title := '⏰ Dernier rappel: Cours dans 15 min';
  END IF;

  FOR v_assignment IN
    SELECT ra.*, r.name AS room_name, s.name AS subject_name,
           u.first_name || ' ' || u.last_name AS teacher_name
    FROM room_assignments ra
    JOIN rooms r ON ra.assigned_room_id = r.id
    JOIN subjects s ON ra.subject_id = s.id
    JOIN users u ON ra.teacher_id = u.id
    WHERE ra.status = 'published'
    AND ra.session_date = v_target_date
    AND (p_notification_window >= 1440 OR ra.start_time BETWEEN v_time_from AND v_time_to)
    AND (
      (p_notification_window >= 1440 AND (ra.t1440_sent_at IS NULL OR ra.t1440_sent_at < NOW() - INTERVAL '12 hours'))
      OR (p_notification_window = 60 AND (ra.t60_sent_at IS NULL OR ra.t60_sent_at < NOW() - INTERVAL '1 hour'))
      OR (p_notification_window = 15 AND (ra.t15_sent_at IS NULL OR ra.t15_sent_at < NOW() - INTERVAL '1 hour'))
    )
  LOOP
    INSERT INTO notifications (user_id, school_id, type, title, body, data)
    VALUES (
      v_assignment.teacher_id, v_assignment.school_id,
      'room_assignment_reminder', v_title,
      format('📍 %s | 📚 %s | 👨‍🏫 %s | ⏰ %s - %s',
        v_assignment.room_name, v_assignment.subject_name,
        v_assignment.teacher_name, v_assignment.start_time, v_assignment.end_time),
      jsonb_build_object('room_assignment_id', v_assignment.id,
        'session_date', v_target_date, 'notification_window', p_notification_window)
    );

    IF p_notification_window >= 1440 THEN
      UPDATE room_assignments SET t1440_sent_at = NOW() WHERE id = v_assignment.id;
    ELSIF p_notification_window = 60 THEN
      UPDATE room_assignments SET t60_sent_at = NOW() WHERE id = v_assignment.id;
    ELSE
      UPDATE room_assignments SET t15_sent_at = NOW() WHERE id = v_assignment.id;
    END IF;

    v_total := v_total + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'notificationsSent', v_total, 'targetDate', v_target_date,
    'message', format('%s notifications T-%s envoyées pour le %s', v_total, p_notification_window, v_target_date));

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'notificationsSent', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_room_assignment_notifications_rpc(INTEGER, DATE) TO authenticated;

-- ===========================================================
-- 2. Backfill: notifications pour les cours déjà publiés
--    sans notification (publiés avant cette migration)
-- ===========================================================
DO $$
DECLARE
  v_assignment RECORD;
  v_student    RECORD;
  v_parent     RECORD;
  v_count      INTEGER := 0;
BEGIN
  FOR v_assignment IN
    SELECT ra.*,
           r.name  AS room_name,
           s.name  AS subject_name,
           u.first_name || ' ' || u.last_name AS teacher_name
    FROM room_assignments ra
    JOIN rooms   r ON ra.assigned_room_id = r.id
    JOIN subjects s ON ra.subject_id        = s.id
    JOIN users   u ON ra.teacher_id         = u.id
    WHERE ra.status            = 'published'
    AND   ra.notification_sent = FALSE
    AND   ra.session_date      > CURRENT_DATE
  LOOP

    -- Notification au professeur
    INSERT INTO notifications (user_id, school_id, type, title, body, data)
    VALUES (
      v_assignment.teacher_id, v_assignment.school_id,
      'room_assignment', '📍 Salle assignée pour votre cours',
      format('Matière: %s | Prof: %s | Date: %s | Heure: %s - %s | Salle: %s',
        v_assignment.subject_name, v_assignment.teacher_name,
        v_assignment.session_date, v_assignment.start_time,
        v_assignment.end_time, v_assignment.room_name),
      jsonb_build_object('room_assignment_id', v_assignment.id,
        'session_date', v_assignment.session_date)
    );
    v_count := v_count + 1;

    -- Notifications aux étudiants (via enrollments)
    FOR v_student IN
      SELECT e.student_id, st.user_id
      FROM enrollments e
      JOIN students st ON e.student_id = st.id
      WHERE e.class_id = ANY(v_assignment.grouped_class_ids)
      AND   e.status   = 'enrolled'
      AND   st.user_id IS NOT NULL
    LOOP
      INSERT INTO notifications (user_id, school_id, type, title, body, data)
      VALUES (
        v_student.user_id, v_assignment.school_id,
        'room_assignment', '📍 Salle de cours assignée',
        format('Matière: %s | Prof: %s | Date: %s | Heure: %s - %s | Salle: %s',
          v_assignment.subject_name, v_assignment.teacher_name,
          v_assignment.session_date, v_assignment.start_time,
          v_assignment.end_time, v_assignment.room_name),
        jsonb_build_object('room_assignment_id', v_assignment.id,
          'session_date', v_assignment.session_date)
      );
      v_count := v_count + 1;

      -- Notifications aux parents (via student_parent_relations -> parents.user_id)
      FOR v_parent IN
        SELECT p.user_id
        FROM student_parent_relations spr
        JOIN parents p ON spr.parent_id = p.id
        WHERE spr.student_id = v_student.student_id
        AND   p.user_id IS NOT NULL
      LOOP
        INSERT INTO notifications (user_id, school_id, type, title, body, data)
        VALUES (
          v_parent.user_id, v_assignment.school_id,
          'room_assignment', '📍 Salle de cours (Enfant)',
          format('Matière: %s | Prof: %s | Date: %s | Heure: %s - %s | Salle: %s',
            v_assignment.subject_name, v_assignment.teacher_name,
            v_assignment.session_date, v_assignment.start_time,
            v_assignment.end_time, v_assignment.room_name),
          jsonb_build_object('room_assignment_id', v_assignment.id,
            'session_date', v_assignment.session_date)
        );
        v_count := v_count + 1;
      END LOOP;
    END LOOP;

    -- Marquer comme notifié
    UPDATE room_assignments
    SET notification_sent = TRUE, notified_at = NOW()
    WHERE id = v_assignment.id;

  END LOOP;

  RAISE NOTICE 'Backfill terminé: % notification(s) créée(s).', v_count;
END;
$$;
