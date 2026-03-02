-- ============================================================================
-- Function: Send notifications when grades are published
-- Description: Creates notifications for students and their parents when grades are published
-- ============================================================================

-- Drop existing function if any
DROP FUNCTION IF EXISTS notify_grade_published CASCADE;

CREATE OR REPLACE FUNCTION notify_grade_published(
  p_grade_id UUID,
  p_publisher_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_grade RECORD;
  v_student RECORD;
  v_school_id UUID;
  v_subject_name VARCHAR;
  v_notifications JSONB := '[]'::JSONB;
BEGIN
  -- Get grade details with student and subject info
  SELECT
    g.*,
    s.first_name as student_first_name,
    s.last_name as student_last_name,
    s.user_id as student_user_id,
    sub.name as subject_name,
    g.school_id
  INTO v_grade
  FROM grades g
  JOIN students s ON s.id = g.student_id
  JOIN subjects sub ON sub.id = g.subject_id
  WHERE g.id = p_grade_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grade not found';
  END IF;

  v_school_id := v_grade.school_id;
  v_subject_name := v_grade.subject_name;

  -- Notification for the student (if they have a user account)
  IF v_grade.student_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, school_id, type, title, body, data, created_at)
    VALUES (
      v_grade.student_user_id,
      v_school_id,
      'grade_published',
      'Nouvelle note disponible',
      format('Votre note en %s a été publiée : %s/%s',
        v_subject_name,
        v_grade.score,
        v_grade.max_score
      ),
      jsonb_build_object(
        'gradeId', p_grade_id,
        'subjectId', v_grade.subject_id,
        'score', v_grade.score,
        'maxScore', v_grade.max_score
      ),
      NOW()
    );

    v_notifications := v_notifications || jsonb_build_object(
      'userId', v_grade.student_user_id,
      'type', 'student'
    );
  END IF;

  -- Notifications for parents
  FOR v_student IN
    SELECT
      p.user_id,
      p.first_name,
      p.last_name
    FROM parents p
    JOIN student_parent_relations spr ON spr.parent_id = p.id
    WHERE spr.student_id = v_grade.student_id
      AND p.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (user_id, school_id, type, title, body, data, created_at)
    VALUES (
      v_student.user_id,
      v_school_id,
      'grade_published',
      format('Nouvelle note pour %s %s',
        v_grade.student_first_name,
        v_grade.student_last_name
      ),
      format('Note en %s : %s/%s',
        v_subject_name,
        v_grade.score,
        v_grade.max_score
      ),
      jsonb_build_object(
        'gradeId', p_grade_id,
        'studentId', v_grade.student_id,
        'subjectId', v_grade.subject_id,
        'score', v_grade.score,
        'maxScore', v_grade.max_score
      ),
      NOW()
    );

    v_notifications := v_notifications || jsonb_build_object(
      'userId', v_student.user_id,
      'type', 'parent',
      'name', format('%s %s', v_student.first_name, v_student.last_name)
    );
  END LOOP;

  -- Return summary of notifications sent
  RETURN jsonb_build_object(
    'success', true,
    'gradeId', p_grade_id,
    'notifications', v_notifications,
    'count', jsonb_array_length(v_notifications)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION notify_grade_published(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION notify_grade_published IS 'Sends notifications to students and parents when a grade is published. Uses SECURITY DEFINER to bypass RLS for notification creation.';
