-- ============================================================================
-- Function: Send notifications when report cards are published
-- Description: Creates notifications for students and their parents when report cards are published
-- Note: Notifications are sent even if payment is blocked - access control is handled separately
-- ============================================================================

-- Drop existing function if any
DROP FUNCTION IF EXISTS notify_report_card_published CASCADE;

CREATE OR REPLACE FUNCTION notify_report_card_published(
  p_report_card_id UUID,
  p_publisher_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_report_card RECORD;
  v_student RECORD;
  v_parent RECORD;
  v_school_id UUID;
  v_period_name VARCHAR;
  v_academic_year_name VARCHAR;
  v_class_name VARCHAR;
  v_mention_text VARCHAR;
  v_notifications JSONB := '[]'::JSONB;
  v_payment_blocked BOOLEAN := FALSE;
BEGIN
  -- Get report card details with student, class, period, and academic year info
  SELECT
    rc.*,
    s.first_name as student_first_name,
    s.last_name as student_last_name,
    s.user_id as student_user_id,
    c.name as class_name,
    p.name as period_name,
    ay.name as academic_year_name
  INTO v_report_card
  FROM report_cards rc
  JOIN students s ON s.id = rc.student_id
  JOIN classes c ON c.id = rc.class_id
  JOIN periods p ON p.id = rc.period_id
  JOIN academic_years ay ON ay.id = rc.academic_year_id
  WHERE rc.id = p_report_card_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report card not found';
  END IF;

  v_school_id := v_report_card.school_id;
  v_period_name := v_report_card.period_name;
  v_academic_year_name := v_report_card.academic_year_name;
  v_class_name := v_report_card.class_name;
  v_mention_text := COALESCE(' - ' || v_report_card.mention, '');

  -- Check if payment is blocked
  v_payment_blocked := (v_report_card.payment_status = 'blocked' AND NOT v_report_card.payment_status_override);

  -- Notification for the student (if they have a user account)
  IF v_report_card.student_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, school_id, type, title, body, data, created_at)
    VALUES (
      v_report_card.student_user_id,
      v_school_id,
      'report_card_published',
      'Bulletin scolaire disponible',
      format('Votre bulletin %s %s est maintenant disponible%sMoyenne : %s/20 - Rang : %s/%s',
        v_period_name,
        v_academic_year_name,
        CASE WHEN v_payment_blocked THEN '. Note: Le téléchargement est bloqué pour cause de paiement. ' ELSE ': ' END,
        v_report_card.overall_average,
        v_report_card.rank_in_class,
        v_report_card.class_size
      ),
      jsonb_build_object(
        'reportCardId', p_report_card_id,
        'studentId', v_report_card.student_id,
        'periodId', v_report_card.period_id,
        'academicYearId', v_report_card.academic_year_id,
        'overallAverage', v_report_card.overall_average,
        'rank', v_report_card.rank_in_class,
        'paymentBlocked', v_payment_blocked
      ),
      NOW()
    );

    v_notifications := v_notifications || jsonb_build_object(
      'userId', v_report_card.student_user_id,
      'type', 'student'
    );
  END IF;

  -- Notifications for parents
  FOR v_parent IN
    SELECT
      p.user_id,
      p.first_name,
      p.last_name
    FROM parents p
    JOIN student_parent_relations spr ON spr.parent_id = p.id
    WHERE spr.student_id = v_report_card.student_id
      AND p.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (user_id, school_id, type, title, body, data, created_at)
    VALUES (
      v_parent.user_id,
      v_school_id,
      'report_card_published',
      format('Bulletin disponible pour %s %s',
        v_report_card.student_first_name,
        v_report_card.student_last_name
      ),
      format('Le bulletin %s %s est disponible%sMoyenne : %s/20 - Rang : %s/%s%s',
        v_period_name,
        v_academic_year_name,
        CASE WHEN v_payment_blocked THEN '. Note: Le téléchargement est bloqué pour cause de paiement. ' ELSE ': ' END,
        v_report_card.overall_average,
        v_report_card.rank_in_class,
        v_report_card.class_size,
        v_mention_text
      ),
      jsonb_build_object(
        'reportCardId', p_report_card_id,
        'studentId', v_report_card.student_id,
        'studentName', format('%s %s', v_report_card.student_first_name, v_report_card.student_last_name),
        'periodId', v_report_card.period_id,
        'academicYearId', v_report_card.academic_year_id,
        'overallAverage', v_report_card.overall_average,
        'rank', v_report_card.rank_in_class,
        'mention', v_report_card.mention,
        'paymentBlocked', v_payment_blocked
      ),
      NOW()
    );

    v_notifications := v_notifications || jsonb_build_object(
      'userId', v_parent.user_id,
      'type', 'parent',
      'name', format('%s %s', v_parent.first_name, v_parent.last_name)
    );
  END LOOP;

  -- Return summary of notifications sent
  RETURN jsonb_build_object(
    'success', true,
    'reportCardId', p_report_card_id,
    'studentId', v_report_card.student_id,
    'period', v_period_name,
    'overallAverage', v_report_card.overall_average,
    'rank', v_report_card.rank_in_class,
    'paymentBlocked', v_payment_blocked,
    'notifications', v_notifications,
    'count', jsonb_array_length(v_notifications)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION notify_report_card_published(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION notify_report_card_published IS 'Sends notifications to students and parents when a report card is published. Notifications are sent even if payment is blocked - access control is handled separately by RLS policies.';
