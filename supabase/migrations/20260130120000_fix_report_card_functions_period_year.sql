-- Ensure report card functions use the academic year from the selected period

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
  v_academic_year_id UUID;
BEGIN
  SELECT p.academic_year_id
  INTO v_academic_year_id
  FROM periods p
  WHERE p.id = p_period_id;

  IF v_academic_year_id IS NULL THEN
    RAISE EXCEPTION 'Period not found';
  END IF;

  SELECT COUNT(*)
  INTO v_class_size
  FROM enrollments
  WHERE class_id = p_class_id
    AND academic_year_id = v_academic_year_id;

  RETURN QUERY
  WITH enrolled_students AS (
    SELECT DISTINCT e.student_id
    FROM enrollments e
    WHERE e.class_id = p_class_id
      AND e.academic_year_id = v_academic_year_id
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
        WHEN sa.avg > 0 THEN (RANK() OVER (ORDER BY sa.avg DESC))::INTEGER
        ELSE NULL
      END as rank,
      v_class_size as class_size
    FROM student_averages sa
  )
  SELECT * FROM ranked_students;
END;
$$ LANGUAGE plpgsql;

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
  v_period_academic_year_id UUID;
BEGIN
  SELECT p.academic_year_id
  INTO v_period_academic_year_id
  FROM periods p
  WHERE p.id = p_period_id;

  IF v_period_academic_year_id IS NULL THEN
    RAISE EXCEPTION 'Period not found';
  END IF;

  SELECT e.class_id, e.academic_year_id, s.school_id
  INTO v_class_id, v_academic_year_id, v_school_id
  FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE e.student_id = p_student_id
    AND e.academic_year_id = v_period_academic_year_id
  LIMIT 1;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Student not enrolled in any class for this period';
  END IF;

  SELECT id INTO v_grading_scale_id
  FROM grading_scales
  WHERE school_id = v_school_id AND is_default = true
  LIMIT 1;

  IF v_grading_scale_id IS NULL THEN
    SELECT id INTO v_grading_scale_id
    FROM grading_scales
    WHERE school_id = v_school_id
    LIMIT 1;
  END IF;

  IF v_grading_scale_id IS NULL THEN
    RAISE EXCEPTION 'No grading scale configured for this school';
  END IF;

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

  v_subject_avgs := COALESCE(v_subject_avgs, '[]'::jsonb);

  SELECT COALESCE(
    SUM((elem->>'average')::DECIMAL * (elem->>'coefficient')::DECIMAL) /
    NULLIF(SUM((elem->>'coefficient')::DECIMAL), 0),
    0
  )
  INTO v_overall_avg
  FROM jsonb_array_elements(v_subject_avgs) elem;

  SELECT r.rank, r.class_size
  INTO v_rank, v_class_size
  FROM calculate_class_rankings(v_class_id, p_period_id) r
  WHERE r.student_id = p_student_id;

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
