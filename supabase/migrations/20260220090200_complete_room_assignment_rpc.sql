-- ============================================
-- Migration: Fonctions RPC complètes pour room assignment
-- ============================================

-- ============================================
-- Function 1: Calculate room assignments (COMPLÈTE)
-- ============================================
DROP FUNCTION IF EXISTS calculate_room_assignments_rpc(UUID, DATE, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION calculate_room_assignments_rpc(
  p_school_id UUID,
  p_session_date DATE,
  p_schedule_id UUID DEFAULT NULL,
  p_auto_publish BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_assignments_created INTEGER := 0;
  v_assignments_updated INTEGER := 0;
  v_insufficient_capacity JSONB := '[]'::JSONB;
  v_config JSONB;
  v_day_of_week TEXT;
  v_slot RECORD;
  v_room RECORD;
  v_total_students INTEGER;
  v_existing_assignment UUID;
  v_selected_room_id UUID;
  v_capacity_status TEXT;
BEGIN
  -- Vérifier la configuration
  SELECT settings->'dynamicRoomAssignment' AS config
  INTO v_config
  FROM schools
  WHERE id = p_school_id;

  IF v_config IS NULL OR NOT COALESCE((v_config->>'enabled')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Module non activé. Allez dans Paramètres → Attrib. Salles.',
      'assignmentsCreated', 0,
      'assignmentsUpdated', 0,
      'insufficientCapacity', '[]'::JSONB,
      'message', 'Module non activé'
    );
  END IF;

  -- Déterminer le jour de la semaine (en anglais pour correspondre à l'enum)
  v_day_of_week := LOWER(TO_CHAR(p_session_date, 'FMDay', 'NLS_DATE_LANGUAGE=ENGLISH'));

  -- Parcourir tous les créneaux de l'emploi du temps
  FOR v_slot IN
    SELECT 
      ss.id AS slot_id,
      ss.teacher_id,
      ss.subject_id,
      ss.class_id,
      ss.start_time,
      ss.end_time,
      ss.campus_id,
      c.name AS class_name,
      (SELECT COUNT(*) FROM enrollments e 
       WHERE e.class_id = ss.class_id 
       AND e.status IN ('enrolled', 'pending')) AS student_count
    FROM schedule_slots ss
    JOIN classes c ON ss.class_id = c.id
    WHERE ss.school_id = p_school_id
    AND (p_schedule_id IS NULL OR ss.schedule_id = p_schedule_id)
    AND ss.day_of_week::text = v_day_of_week
  LOOP
    -- Calculer le nombre total d'étudiants
    v_total_students := COALESCE(v_slot.student_count, 0);
    
    IF v_total_students = 0 THEN
      CONTINUE; -- Ignorer les classes sans étudiants
    END IF;

    -- Chercher une salle disponible
    v_selected_room_id := NULL;
    v_capacity_status := 'insufficient';

    -- Chercher la meilleure salle (avec marge de capacité)
    FOR v_room IN
      SELECT 
        r.id,
        r.name,
        r.capacity,
        CASE 
          WHEN r.capacity >= v_total_students * 1.2 THEN 'optimal'
          WHEN r.capacity >= v_total_students THEN 'sufficient'
          ELSE 'insufficient'
        END AS status
      FROM rooms r
      WHERE r.school_id = p_school_id
      AND (v_slot.campus_id IS NULL OR r.campus_id = v_slot.campus_id)
      AND r.is_available = true
      AND NOT EXISTS (
        -- Vérifier si la salle est déjà assignée à ce créneau
        SELECT 1 FROM room_assignments ra
        WHERE ra.assigned_room_id = r.id
        AND ra.session_date = p_session_date
        AND ra.start_time = v_slot.start_time
        AND ra.end_time = v_slot.end_time
        AND ra.status != 'cancelled'
      )
      ORDER BY 
        CASE WHEN r.capacity >= v_total_students THEN 0 ELSE 1 END,
        r.capacity ASC
      LIMIT 1
    LOOP
      v_selected_room_id := v_room.id;
      v_capacity_status := v_room.status;
    END LOOP;

    -- Si aucune salle n'est trouvée, prendre la plus grande disponible
    IF v_selected_room_id IS NULL THEN
      SELECT r.id INTO v_selected_room_id
      FROM rooms r
      WHERE r.school_id = p_school_id
      AND (v_slot.campus_id IS NULL OR r.campus_id = v_slot.campus_id)
      AND r.is_available = true
      ORDER BY r.capacity DESC
      LIMIT 1;
      
      v_capacity_status := 'insufficient';
    END IF;

    -- Vérifier s'il existe déjà une attribution
    SELECT id INTO v_existing_assignment
    FROM room_assignments
    WHERE school_id = p_school_id
    AND session_date = p_session_date
    AND teacher_id = v_slot.teacher_id
    AND subject_id = v_slot.subject_id
    AND start_time = v_slot.start_time
    AND end_time = v_slot.end_time
    LIMIT 1;

    IF v_existing_assignment IS NOT NULL THEN
      -- Mettre à jour l'attribution existante
      UPDATE room_assignments
      SET 
        assigned_room_id = v_selected_room_id,
        total_students = v_total_students,
        capacity_status = v_capacity_status,
        status = CASE WHEN p_auto_publish THEN 'published' ELSE 'updated' END,
        updated_at = NOW(),
        version = version + 1
      WHERE id = v_existing_assignment;
      
      v_assignments_updated := v_assignments_updated + 1;
    ELSE
      -- Créer une nouvelle attribution
      INSERT INTO room_assignments (
        school_id,
        session_date,
        schedule_slot_id,
        teacher_id,
        subject_id,
        campus_id,
        start_time,
        end_time,
        grouped_class_ids,
        total_students,
        assigned_room_id,
        assignment_method,
        capacity_status,
        status,
        calculated_at
      ) VALUES (
        p_school_id,
        p_session_date,
        v_slot.slot_id,
        v_slot.teacher_id,
        v_slot.subject_id,
        v_slot.campus_id,
        v_slot.start_time,
        v_slot.end_time,
        ARRAY[v_slot.class_id],
        v_total_students,
        v_selected_room_id,
        'auto',
        v_capacity_status,
        CASE WHEN p_auto_publish THEN 'published' ELSE 'draft' END,
        NOW()
      );
      
      v_assignments_created := v_assignments_created + 1;
    END IF;

    -- Si capacité insuffisante, ajouter à la liste
    IF v_capacity_status = 'insufficient' THEN
      v_insufficient_capacity := v_insufficient_capacity || jsonb_build_object(
        'teacherId', v_slot.teacher_id,
        'subjectId', v_slot.subject_id,
        'requiredCapacity', v_total_students,
        'time', v_slot.start_time || ' - ' || v_slot.end_time
      );
    END IF;
  END LOOP;

  -- Publier automatiquement si demandé
  IF p_auto_publish THEN
    UPDATE room_assignments
    SET 
      status = 'published',
      published_at = NOW()
    WHERE school_id = p_school_id
    AND session_date = p_session_date
    AND status = 'draft';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assignmentsCreated', v_assignments_created,
    'assignmentsUpdated', v_assignments_updated,
    'insufficientCapacity', v_insufficient_capacity,
    'message', format('%s attributions créées, %s mises à jour', v_assignments_created, v_assignments_updated)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE,
    'assignmentsCreated', 0,
    'assignmentsUpdated', 0,
    'insufficientCapacity', '[]'::JSONB,
    'message', 'Erreur: ' || SQLERRM
  );
END;
$$;

-- ============================================
-- Function 2: Publish room assignments (COMPLÈTE)
-- ============================================
DROP FUNCTION IF EXISTS publish_room_assignments_rpc(UUID, DATE);

CREATE OR REPLACE FUNCTION publish_room_assignments_rpc(
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

  -- Mettre à jour les attributions en brouillon
  UPDATE room_assignments
  SET 
    status = 'published',
    published_at = NOW(),
    updated_at = NOW()
  WHERE school_id = p_school_id
  AND session_date = p_session_date
  AND status = 'draft';

  GET DIAGNOSTICS v_published_count = ROW_COUNT;

  -- Créer les notifications
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
      user_id,
      school_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_assignment.teacher_id,
      p_school_id,
      'room_assignment',
      '📍 Salle assignée',
      format('Matière: %s\nProf: %s\nHeure: %s - %s\nSalle: %s',
        v_assignment.subject_name,
        v_assignment.teacher_name,
        v_assignment.start_time,
        v_assignment.end_time,
        v_assignment.room_name
      ),
      jsonb_build_object(
        'room_assignment_id', v_assignment.id,
        'session_date', p_session_date
      )
    );

    -- Marquer comme notifié
    UPDATE room_assignments
    SET notification_sent = TRUE, notified_at = NOW()
    WHERE id = v_assignment.id;

    v_notifications_sent := v_notifications_sent + 1;
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

-- ============================================
-- Function 3: Send notifications (COMPLÈTE)
-- ============================================
DROP FUNCTION IF EXISTS send_room_assignment_notifications_rpc(INTEGER, DATE);

CREATE OR REPLACE FUNCTION send_room_assignment_notifications_rpc(
  p_notification_window INTEGER,
  p_session_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_notifications INTEGER := 0;
  v_assignment RECORD;
  v_time_from TIME;
  v_time_to TIME;
BEGIN
  -- Calculer la fenêtre de temps
  v_time_from := (CURRENT_TIME + (p_notification_window - 5) * INTERVAL '1 minute')::TIME;
  v_time_to := (CURRENT_TIME + (p_notification_window + 5) * INTERVAL '1 minute')::TIME;

  -- Récupérer les attributions à notifier
  FOR v_assignment IN
    SELECT ra.*,
           r.name AS room_name,
           s.name AS subject_name,
           u.first_name || ' ' || u.last_name AS teacher_name
    FROM room_assignments ra
    JOIN rooms r ON ra.assigned_room_id = r.id
    JOIN subjects s ON ra.subject_id = s.id
    JOIN users u ON ra.teacher_id = u.id
    WHERE ra.status = 'published'
    AND ra.session_date = p_session_date
    AND ra.start_time BETWEEN v_time_from AND v_time_to
    AND (
      (p_notification_window = 60 AND (ra.t60_sent_at IS NULL OR ra.t60_sent_at < NOW() - INTERVAL '1 hour'))
      OR (p_notification_window = 15 AND (ra.t15_sent_at IS NULL OR ra.t15_sent_at < NOW() - INTERVAL '1 hour'))
    )
  LOOP
    -- Créer la notification de rappel
    INSERT INTO notifications (
      user_id,
      school_id,
      type,
      title,
      message,
      priority,
      metadata
    ) VALUES (
      v_assignment.teacher_id,
      v_assignment.school_id,
      'room_assignment_reminder',
      CASE 
        WHEN p_notification_window = 60 THEN '🔔 Rappel: Cours dans 1 heure'
        ELSE '⏰ Dernier rappel: Cours dans 15 min'
      END,
      format('📍 Salle: %s\n📚 %s\n👨‍🏫 %s\n⏰ %s - %s',
        v_assignment.room_name,
        v_assignment.subject_name,
        v_assignment.teacher_name,
        v_assignment.start_time,
        v_assignment.end_time
      ),
      CASE WHEN p_notification_window = 15 THEN 'high' ELSE 'normal' END,
      jsonb_build_object(
        'room_assignment_id', v_assignment.id,
        'session_date', p_session_date,
        'notification_window', p_notification_window
      )
    );

    -- Mettre à jour le timestamp
    IF p_notification_window = 60 THEN
      UPDATE room_assignments SET t60_sent_at = NOW() WHERE id = v_assignment.id;
    ELSE
      UPDATE room_assignments SET t15_sent_at = NOW() WHERE id = v_assignment.id;
    END IF;

    v_total_notifications := v_total_notifications + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'notificationsSent', v_total_notifications,
    'message', format('%s notifications T-%s envoyées', v_total_notifications, p_notification_window)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'notificationsSent', 0
  );
END;
$$;

-- ============================================
-- Grants
-- ============================================
GRANT EXECUTE ON FUNCTION calculate_room_assignments_rpc(UUID, DATE, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_room_assignments_rpc(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION send_room_assignment_notifications_rpc(INTEGER, DATE) TO authenticated;

-- Comments
COMMENT ON FUNCTION calculate_room_assignments_rpc IS 'Calcule complètement les attributions de salles';
COMMENT ON FUNCTION publish_room_assignments_rpc IS 'Publie les attributions et envoie les notifications';
COMMENT ON FUNCTION send_room_assignment_notifications_rpc IS 'Envoie les rappels T-60 ou T-15';
