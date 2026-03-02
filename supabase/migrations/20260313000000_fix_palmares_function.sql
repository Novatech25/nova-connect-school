-- Migration: Fix get_class_report_cards_stats coefficient reference
-- Description: Corrects the reference from s.coefficient to sub.coefficient

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
        SUM((g.score / g.max_score) * 20 * COALESCE(sub.coefficient, 1)) / NULLIF(SUM(COALESCE(sub.coefficient, 1)), 0),
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
      sd.student_id,
      sd.first_name,
      sd.last_name,
      sd.overall_average,
      RANK() OVER (ORDER BY sd.overall_average DESC) as rank_in_class
    FROM student_data sd
  )
  SELECT
    r.student_id,
    r.first_name as student_first_name,
    r.last_name as student_last_name,
    r.overall_average::DECIMAL(5,2),
    r.rank_in_class::INTEGER,
    m.mention_label as mention
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
