-- Migration: Add T-1440 notifications and notify students/parents on publish
-- NOTE: La table 'notifications' utilise 'body' (pas 'message') et 'data' (pas 'metadata')
-- Voir migration 20250131000005_rename_message_to_body_notifications.sql

ALTER TABLE public.room_assignments
ADD COLUMN IF NOT EXISTS t1440_sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_room_assignments_t1440_sent ON public.room_assignments(t1440_sent_at) WHERE t1440_sent_at IS NULL;

-- 1. Update publish_room_assignments_rpc: notify teachers, students and parents on publish
DROP FUNCTION IF EXISTS public.publish_room_assignments_rpc(UUID, DATE);

CREATE OR REPLACE FUNCTION public.publish_room_assignments_rpc(
  p_school_id UUID,
  p_session_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_published_count INTEGER := 0;
  v_notifications_sent INTEGER := 0;
  v_assignment RECORD;
  v_config JSONB;
  v_message TEXT;
  v_student RECORD;
  v_parent RECORD;
BEGIN
  -- Vérifier la configuration
  SELECT settings->'dynamicRoomAssignment' AS config
  INTO v_config
  FROM schools
  WHERE id = p_school_id;

  IF v_config IS NULL OR NOT COALESCE((v_config->>'enabled')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Module non activé',
      'published', 0,
      'notificationsSent', 0
    );
  END IF;

  -- Mettre à jour les attributions en brouillon vers publié
  UPDATE room_assignments
  SET 
    status = 'published',
    published_at = NOW(),
    updated_at = NOW()
  WHERE school_id = p_school_id
  AND session_date = p_session_date
  AND status = 'draft';

  GET DIAGNOSTICS v_published_count = ROW_COUNT;

  -- Créer les notifications pour toutes les attributions publiées non encore notifiées
  FOR v_assignment IN
    SELECT ra.*, 
           r.name AS room_name,
           s.name AS subject_name,
           u.first_name || ' ' || u.last_name AS teacher_name
    FROM room_assignments ra
    JOIN rooms r ON ra.assigned_room_id = r.id
    JOIN subjects s ON ra.subject_id = s.id
    JOIN users u ON ra.teacher_id = u.id
    WHERE ra.school_id = p_school_id
    AND ra.session_date = p_session_date
    AND ra.status = 'published'
    AND ra.notification_sent = FALSE
  LOOP
    -- Notification pour le professeur
    INSERT INTO notifications (
      user_id, school_id, type, title, body, data
    ) VALUES (
      v_assignment.teacher_id, p_school_id, 'room_assignment', '📍 Salle assignée',
      format('Matière: %s | Prof: %s | Heure: %s - %s | Salle: %s',
        v_assignment.subject_name, v_assignment.teacher_name,
        v_assignment.start_time, v_assignment.end_time, v_assignment.room_name),
      jsonb_build_object('room_assignment_id', v_assignment.id, 'session_date', p_session_date)
    );
    v_notifications_sent := v_notifications_sent + 1;

    -- Notifications pour les étudiants inscrits dans les classes concernées
    FOR v_student IN
      SELECT ce.student_id
      FROM class_enrollments ce
      WHERE ce.class_id = ANY(v_assignment.grouped_class_ids)
    LOOP
      INSERT INTO notifications (
        user_id, school_id, type, title, body, data
      ) VALUES (
        v_student.student_id, p_school_id, 'room_assignment', '📍 Salle de cours assignée',
        format('Matière: %s | Prof: %s | Date: %s | Heure: %s - %s | Salle: %s',
          v_assignment.subject_name, v_assignment.teacher_name, p_session_date,
          v_assignment.start_time, v_assignment.end_time, v_assignment.room_name),
        jsonb_build_object('room_assignment_id', v_assignment.id, 'session_date', p_session_date)
      );
      v_notifications_sent := v_notifications_sent + 1;
      
      -- Notifications pour les parents/tuteurs
      FOR v_parent IN
        SELECT fr.parent_id
        FROM family_relationships fr
        WHERE fr.child_id = v_student.student_id
      LOOP
        INSERT INTO notifications (
          user_id, school_id, type, title, body, data
        ) VALUES (
          v_parent.parent_id, p_school_id, 'room_assignment', '📍 Salle de cours (Enfant)',
          format('Matière: %s | Prof: %s | Date: %s | Heure: %s - %s | Salle: %s',
            v_assignment.subject_name, v_assignment.teacher_name, p_session_date,
            v_assignment.start_time, v_assignment.end_time, v_assignment.room_name),
          jsonb_build_object('room_assignment_id', v_assignment.id, 'session_date', p_session_date)
        );
        v_notifications_sent := v_notifications_sent + 1;
      END LOOP;
    END LOOP;

    -- Marquer cette attribution comme notifiée
    UPDATE room_assignments
    SET notification_sent = TRUE, notified_at = NOW()
    WHERE id = v_assignment.id;

  END LOOP;

  v_message := format('%s attributions publiées, %s notifications envoyées', v_published_count, v_notifications_sent);

  RETURN jsonb_build_object(
    'success', true,
    'published', v_published_count,
    'notificationsSent', v_notifications_sent,
    'message', v_message
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'published', 0,
    'notificationsSent', 0
  );
END;
$$;
