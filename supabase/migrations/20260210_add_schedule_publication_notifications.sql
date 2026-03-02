-- ============================================================================
-- Migration: Add Schedule Publication Notifications
-- Description: Creates notifications for teachers and students when schedules are published/republished
-- ============================================================================

-- Drop existing function if any
DROP FUNCTION IF EXISTS notify_schedule_publication(UUID, BOOLEAN);

-- ============================================================================
-- Function: notify_schedule_publication
-- Description: Creates notifications for all users affected by a schedule publication
-- Parameters:
--   p_schedule_id: UUID of the schedule being published
--   p_is_republish: Whether this is a republication (true) or initial publication (false)
-- Returns: JSONB with success status, notification count, and user IDs notified
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_schedule_publication(
  p_schedule_id UUID,
  p_is_republish BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_teacher RECORD;
  v_student RECORD;
  v_notification_count INTEGER := 0;
  v_user_ids JSONB := '[]'::JSONB;
  v_title TEXT;
  v_message TEXT;
  v_notification_type TEXT;
BEGIN
  -- ============================================
  -- 1. GET SCHEDULE INFO
  -- ============================================
  SELECT 
    s.id,
    s.name,
    s.school_id,
    ay.name as academic_year_name,
    ay.id as academic_year_id
  INTO v_schedule
  FROM schedules s
  JOIN academic_years ay ON ay.id = s.academic_year_id
  WHERE s.id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Schedule not found'
    );
  END IF;

  -- Set notification type and messages
  IF p_is_republish THEN
    v_notification_type := 'schedule_republished';
    v_title := 'Emploi du temps mis à jour';
  ELSE
    v_notification_type := 'schedule_published';
    v_title := 'Nouvel emploi du temps publié';
  END IF;

  -- ============================================
  -- 2. NOTIFY TEACHERS
  -- ============================================
  FOR v_teacher IN
    SELECT DISTINCT
      u.id as user_id,
      u.first_name,
      u.last_name,
      COUNT(DISTINCT ss.id) as slot_count
    FROM schedule_slots ss
    JOIN users u ON u.id = ss.teacher_id
    WHERE ss.schedule_id = p_schedule_id
      AND ss.teacher_id IS NOT NULL
    GROUP BY u.id, u.first_name, u.last_name
  LOOP
    -- Create message for teacher
    IF p_is_republish THEN
      v_message := format(
        'L''emploi du temps "%s" (%s) a été mis à jour. Vous avez %s créneau(x) assigné(s).',
        v_schedule.name,
        v_schedule.academic_year_name,
        v_teacher.slot_count
      );
    ELSE
      v_message := format(
        'L''emploi du temps "%s" (%s) a été publié. Vous avez %s créneau(x) assigné(s).',
        v_schedule.name,
        v_schedule.academic_year_name,
        v_teacher.slot_count
      );
    END IF;

    -- Insert notification
    INSERT INTO notifications (
      user_id,
      school_id,
      type,
      title,
      body,
      data,
      created_at
    ) VALUES (
      v_teacher.user_id,
      v_schedule.school_id,
      v_notification_type,
      v_title,
      v_message,
      jsonb_build_object(
        'scheduleId', v_schedule.id,
        'scheduleName', v_schedule.name,
        'academicYearId', v_schedule.academic_year_id,
        'academicYearName', v_schedule.academic_year_name,
        'slotCount', v_teacher.slot_count,
        'userRole', 'teacher',
        'isRepublish', p_is_republish
      ),
      NOW()
    );

    v_notification_count := v_notification_count + 1;
    v_user_ids := v_user_ids || jsonb_build_object('userId', v_teacher.user_id, 'role', 'teacher');
  END LOOP;

  -- ============================================
  -- 3. NOTIFY STUDENTS
  -- ============================================
  FOR v_student IN
    SELECT DISTINCT
      u.id as user_id,
      u.first_name,
      u.last_name,
      c.name as class_name,
      COUNT(DISTINCT ss.id) as slot_count
    FROM schedule_slots ss
    JOIN classes c ON c.id = ss.class_id
    JOIN students s ON s.class_id = c.id
    JOIN users u ON u.id = s.user_id
    WHERE ss.schedule_id = p_schedule_id
      AND ss.class_id IS NOT NULL
      AND s.user_id IS NOT NULL
    GROUP BY u.id, u.first_name, u.last_name, c.name
  LOOP
    -- Create message for student
    IF p_is_republish THEN
      v_message := format(
        'L''emploi du temps "%s" (%s) de votre classe (%s) a été mis à jour. %s créneau(x) au total.',
        v_schedule.name,
        v_schedule.academic_year_name,
        v_student.class_name,
        v_student.slot_count
      );
    ELSE
      v_message := format(
        'L''emploi du temps "%s" (%s) de votre classe (%s) est maintenant disponible. %s créneau(x) au total.',
        v_schedule.name,
        v_schedule.academic_year_name,
        v_student.class_name,
        v_student.slot_count
      );
    END IF;

    -- Insert notification
    INSERT INTO notifications (
      user_id,
      school_id,
      type,
      title,
      body,
      data,
      created_at
    ) VALUES (
      v_student.user_id,
      v_schedule.school_id,
      v_notification_type,
      v_title,
      v_message,
      jsonb_build_object(
        'scheduleId', v_schedule.id,
        'scheduleName', v_schedule.name,
        'academicYearId', v_schedule.academic_year_id,
        'academicYearName', v_schedule.academic_year_name,
        'className', v_student.class_name,
        'slotCount', v_student.slot_count,
        'userRole', 'student',
        'isRepublish', p_is_republish
      ),
      NOW()
    );

    v_notification_count := v_notification_count + 1;
    v_user_ids := v_user_ids || jsonb_build_object('userId', v_student.user_id, 'role', 'student');
  END LOOP;

  -- ============================================
  -- 4. RETURN SUCCESS
  -- ============================================
  RETURN jsonb_build_object(
    'success', true,
    'scheduleId', v_schedule.id,
    'scheduleName', v_schedule.name,
    'isRepublish', p_is_republish,
    'notificationsCount', v_notification_count,
    'userIds', v_user_ids
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', 'Error creating schedule publication notifications: ' || SQLERRM
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION notify_schedule_publication(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_schedule_publication(UUID, BOOLEAN) TO service_role;

-- Add comment
COMMENT ON FUNCTION notify_schedule_publication IS 'Creates notifications for teachers and students when a schedule is published or republished. Notifies all teachers assigned to slots and all students in classes assigned to slots.';
