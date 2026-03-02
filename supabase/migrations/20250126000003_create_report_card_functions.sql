-- Migration: Create report card calculation functions
-- Description: SQL functions for calculating rankings, mentions, and generating report card data

-- ============================================================================
-- FUNCTION: Calculate class rankings for all students in a period
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_class_rankings(
  p_class_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  student_id UUID,
  overall_average DECIMAL(5,2),
  rank INTEGER,
  class_size INTEGER
) AS $$
DECLARE
  v_class_size INTEGER;
BEGIN
  -- Get class size from enrollments
  SELECT COUNT(*)
  INTO v_class_size
  FROM enrollments
  WHERE class_id = p_class_id
    AND academic_year_id = (
      SELECT ay.id FROM academic_years ay
      WHERE ay.is_current = true
      LIMIT 1
    );

  RETURN QUERY
  WITH enrolled_students AS (
    -- Get all enrolled students
    SELECT DISTINCT e.student_id
    FROM enrollments e
    WHERE e.class_id = p_class_id
      AND e.academic_year_id = (
        SELECT ay.id FROM academic_years ay
        WHERE ay.is_current = true
        LIMIT 1
      )
  ),
  student_averages AS (
    SELECT
      es.student_id,
      COALESCE(
        SUM((g.score / g.max_score) * 20 * s.coefficient) / NULLIF(SUM(s.coefficient), 0),
        0
      ) as avg
    FROM enrolled_students es
    LEFT JOIN grades g ON g.student_id = es.student_id
      AND g.period_id = p_period_id
      AND g.status = 'published'
    LEFT JOIN subjects s ON s.id = g.subject_id
    GROUP BY es.student_id
  ),
  ranked_students AS (
    SELECT
      sa.student_id,
      sa.avg as overall_average,
      CASE
        WHEN sa.avg > 0 THEN RANK() OVER (ORDER BY sa.avg DESC)
        ELSE NULL
      END as rank,
      v_class_size as class_size
    FROM student_averages sa
  )
  SELECT * FROM ranked_students;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Determine mention based on average and grading scale
-- ============================================================================
CREATE OR REPLACE FUNCTION get_mention_for_average(
  p_average DECIMAL(5,2),
  p_grading_scale_id UUID
)
RETURNS TABLE (
  mention_label VARCHAR(50),
  mention_color VARCHAR(7)
) AS $$
DECLARE
  scale_config JSONB;
  mention JSONB;
BEGIN
  SELECT gs.scale_config INTO scale_config
  FROM grading_scales gs
  WHERE gs.id = p_grading_scale_id;

  IF scale_config IS NULL THEN
    RETURN QUERY SELECT NULL::VARCHAR(50), NULL::VARCHAR(7);
    RETURN;
  END IF;

  FOR mention IN SELECT * FROM jsonb_array_elements(scale_config->'mentions')
  LOOP
    IF p_average >= (mention->>'min')::DECIMAL
       AND p_average < (mention->>'max')::DECIMAL THEN
      RETURN QUERY
      SELECT
        (mention->>'label')::VARCHAR(50),
        (mention->>'color')::VARCHAR(7);
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT NULL::VARCHAR(50), NULL::VARCHAR(7);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Generate complete report card data for a student
-- ============================================================================
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

  -- Calculate subject averages
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

  -- Get mention
  SELECT m.mention_label, m.mention_color
  INTO v_mention, v_mention_color
  FROM get_mention_for_average(v_overall_avg, v_grading_scale_id) m;

  RETURN QUERY
  SELECT
    p_student_id,
    v_class_id,
    v_academic_year_id,
    v_grading_scale_id,
    v_overall_avg,
    v_rank,
    v_class_size,
    v_mention,
    v_mention_color,
    v_subject_avgs;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get report cards for a class with statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_class_report_cards_stats(
  p_class_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  student_id UUID,
  student_first_name VARCHAR,
  student_last_name VARCHAR,
  overall_average DECIMAL(5,2),
  rank_in_class INTEGER,
  mention VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  WITH student_data AS (
    SELECT
      s.id as student_id,
      s.first_name,
      s.last_name,
      COALESCE(
        SUM((g.score / g.max_score) * 20 * s.coefficient) / NULLIF(SUM(s.coefficient), 0),
        0
      ) as overall_average
    FROM students s
    LEFT JOIN grades g ON g.student_id = s.id
      AND g.period_id = p_period_id
      AND g.status = 'published'
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    WHERE s.id IN (
      SELECT e.student_id FROM enrollments e
      WHERE e.class_id = p_class_id
        AND e.academic_year_id = (
          SELECT ay.id FROM academic_years ay
          WHERE ay.is_current = true
          LIMIT 1
        )
    )
    GROUP BY s.id, s.first_name, s.last_name
  ),
  ranked AS (
    SELECT
      student_id,
      student_first_name,
      student_last_name,
      overall_average,
      RANK() OVER (ORDER BY overall_average DESC) as rank_in_class
    FROM student_data
  )
  SELECT
    r.student_id,
    r.student_first_name,
    r.student_last_name,
    r.overall_average,
    r.rank_in_class,
    m.mention_label
  FROM ranked r
  LEFT JOIN get_mention_for_average(r.overall_average, (
    SELECT gs.id FROM grading_scales gs
    JOIN classes c ON c.school_id = gs.school_id
    WHERE c.id = p_class_id AND gs.is_default = true
    LIMIT 1
  )) m ON true
  ORDER BY r.overall_average DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION calculate_class_rankings IS 'Calculates class rankings for all students in a class for a given period';
COMMENT ON FUNCTION get_mention_for_average IS 'Determines the mention (e.g., Excellent, Très Bien) based on average and grading scale';
COMMENT ON FUNCTION generate_report_card_data IS 'Generates complete report card data including averages, rankings, and mentions for a student';
COMMENT ON FUNCTION get_class_report_cards_stats IS 'Returns statistics for all students in a class for a given period';
