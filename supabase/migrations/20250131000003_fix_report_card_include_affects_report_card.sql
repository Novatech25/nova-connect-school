-- ============================================================================
-- Fix: Include affects_report_card filter in report card generation
-- Created: 2025-01-31
-- Description: Updates the generate_report_card_data function to only include grades with affects_report_card = true
-- ============================================================================

-- Drop the old function (we'll recreate it with the fix)
DROP FUNCTION IF EXISTS generate_report_card_data CASCADE;

-- Recreate the function with affects_report_card filter
CREATE OR REPLACE FUNCTION generate_report_card_data(
  p_student_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  student_id UUID,
  class_id UUID,
  academic_year_id UUID,
  grading_scale_id UUID,
  overall_average DECIMAL(5,2),
  rank_in_class INTEGER,
  class_size INTEGER,
  mention VARCHAR(50),
  mention_color VARCHAR(7),
  subject_averages JSONB
) AS $$
DECLARE
  v_class_id UUID;
  v_academic_year_id UUID;
  v_grading_scale_id UUID;
  v_school_id UUID;
  v_overall_avg DECIMAL(5,2);
  v_rank INTEGER;
  v_class_size INTEGER;
  v_mention VARCHAR(50);
  v_mention_color VARCHAR(7);
  v_subject_avgs JSONB;
BEGIN
  -- Get student's class and academic year
  SELECT e.class_id, e.academic_year_id, s.school_id
  INTO v_class_id, v_academic_year_id, v_school_id
  FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE e.student_id = p_student_id
    AND e.academic_year_id = (
      SELECT ay.id FROM academic_years ay
      WHERE ay.is_current = true AND ay.school_id = s.school_id
    )
  LIMIT 1;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Student not enrolled in any class';
  END IF;

  -- Get default grading scale
  SELECT id INTO v_grading_scale_id
  FROM grading_scales
  WHERE school_id = v_school_id AND is_default = true
  LIMIT 1;

  -- Calculate subject averages - ONLY include grades with affects_report_card = true
  SELECT jsonb_agg(
    jsonb_build_object(
      'subjectId', subject_id,
      'subjectName', subject_name,
      'average', average,
      'coefficient', total_coefficient,
      'gradeCount', grade_count
    )
  )
  INTO v_subject_avgs
  FROM (
    SELECT
      s.id as subject_id,
      s.name as subject_name,
      COALESCE(
        SUM((g.score / g.max_score) * 20 * g.coefficient) / NULLIF(SUM(g.coefficient), 0),
        0
      ) as average,
      s.coefficient as total_coefficient,
      COUNT(g.id) as grade_count
    FROM subjects s
    LEFT JOIN grades g ON g.subject_id = s.id
      AND g.student_id = p_student_id
      AND g.period_id = p_period_id
      AND g.status = 'published'
      AND g.affects_report_card = true  -- <-- FIX: Only include grades that affect report card
    WHERE s.school_id = v_school_id
      AND s.is_active = true
    GROUP BY s.id, s.name, s.coefficient
    HAVING COUNT(g.id) > 0
  ) subject_data;

  -- Coalesce to empty array if no subjects have grades
  v_subject_avgs := COALESCE(v_subject_avgs, '[]'::jsonb);

  -- Calculate overall average
  SELECT COALESCE(
    SUM((elem->>'average')::DECIMAL * (elem->>'coefficient')::DECIMAL) /
    NULLIF(SUM((elem->>'coefficient')::DECIMAL), 0),
    0
  )
  INTO v_overall_avg
  FROM jsonb_array_elements(v_subject_avgs) elem;

  -- Get ranking
  SELECT r.rank, r.class_size
  INTO v_rank, v_class_size
  FROM calculate_class_rankings(v_class_id, p_period_id) r
  WHERE r.student_id = p_student_id;

  -- Determine mention based on grading scale
  SELECT
    m.mention_label,
    m.mention_color
  INTO v_mention, v_mention_color
  FROM get_mention_for_average(v_overall_avg, v_grading_scale_id) m;

  -- Return the result
  RETURN QUERY
  SELECT
    p_student_id as student_id,
    v_class_id as class_id,
    v_academic_year_id as academic_year_id,
    v_grading_scale_id as grading_scale_id,
    v_overall_avg as overall_average,
    v_rank as rank_in_class,
    v_class_size as class_size,
    v_mention as mention,
    v_mention_color as mention_color,
    v_subject_avgs as subject_averages;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION generate_report_card_data(UUID, UUID) IS 'Generates complete report card data including averages, rankings, and mentions for a student. ONLY includes grades with affects_report_card = true and status = published.';
