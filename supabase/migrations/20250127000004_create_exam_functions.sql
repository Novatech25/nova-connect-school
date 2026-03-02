-- Migration: Create SQL Functions for Exam Module
-- Created: 2025-01-27
-- Description: Creates SQL functions for exam calculations and operations

-- Function to calculate exam results for a deliberation AND persist them
CREATE OR REPLACE FUNCTION calculate_exam_results(p_deliberation_id UUID)
RETURNS TABLE (
  student_id UUID,
  overall_average DECIMAL(5,2),
  rank_in_class INTEGER,
  class_size INTEGER,
  is_passed BOOLEAN,
  mention VARCHAR(50),
  mention_color VARCHAR(7)
) AS $$
DECLARE
  v_exam_session_id UUID;
  v_school_id UUID;
  v_class_id UUID;
BEGIN
  -- Get deliberation context
  SELECT exam_session_id, school_id, class_id
  INTO v_exam_session_id, v_school_id, v_class_id
  FROM exam_deliberations
  WHERE id = p_deliberation_id;

  -- Calculate and insert results
  RETURN QUERY
  WITH student_averages AS (
    SELECT
      s.id AS student_id,
      AVG(g.score / g.max_score * 20 * g.coefficient) / AVG(g.coefficient) AS avg_score
    FROM students s
    JOIN enrollments e ON e.student_id = s.id
    JOIN exam_deliberations ed ON ed.class_id = e.class_id
    JOIN exam_sessions es ON es.id = ed.exam_session_id
    JOIN grades g ON g.student_id = s.id
      AND g.period_id = es.period_id
      AND g.status = 'published'
    WHERE ed.id = p_deliberation_id
    GROUP BY s.id
  ),
  ranked_students AS (
    SELECT
      sa.student_id,
      sa.avg_score,
      RANK() OVER (ORDER BY sa.avg_score DESC) AS rank,
      COUNT(*) OVER () AS total_count
    FROM student_averages sa
  ),
  grading_info AS (
    SELECT gs.*
    FROM exam_deliberations ed
    JOIN classes c ON c.id = ed.class_id
    JOIN grading_scales gs ON gs.id = c.grading_scale_id
    WHERE ed.id = p_deliberation_id
    LIMIT 1
  ),
  calculated_results AS (
    SELECT
      rs.student_id,
      ROUND(rs.avg_score, 2)::DECIMAL(5,2) AS overall_average,
      rs.rank::INTEGER AS rank_in_class,
      rs.total_count::INTEGER AS class_size,
      (rs.avg_score >= COALESCE((SELECT passing_grade FROM grading_info), 10))::BOOLEAN AS is_passed,
      CASE
        WHEN rs.avg_score >= 16 THEN 'Très Bien'
        WHEN rs.avg_score >= 14 THEN 'Bien'
        WHEN rs.avg_score >= 12 THEN 'Assez Bien'
        WHEN rs.avg_score >= 10 THEN 'Passable'
        ELSE 'Insuffisant'
      END AS mention,
      CASE
        WHEN rs.avg_score >= 16 THEN '#10b981'
        WHEN rs.avg_score >= 14 THEN '#3b82f6'
        WHEN rs.avg_score >= 12 THEN '#8b5cf6'
        WHEN rs.avg_score >= 10 THEN '#f59e0b'
        ELSE '#ef4444'
      END AS mention_color
    FROM ranked_students rs
  )
  -- Persist results to exam_results table
  INSERT INTO exam_results (
    school_id,
    exam_session_id,
    deliberation_id,
    student_id,
    overall_average,
    rank_in_class,
    class_size,
    is_passed,
    mention,
    mention_color
  )
  SELECT
    v_school_id,
    v_exam_session_id,
    p_deliberation_id,
    cr.student_id,
    cr.overall_average,
    cr.rank_in_class,
    cr.class_size,
    cr.is_passed,
    cr.mention,
    cr.mention_color
  FROM calculated_results cr
  ON CONFLICT (exam_session_id, student_id)
  DO UPDATE SET
    overall_average = EXCLUDED.overall_average,
    rank_in_class = EXCLUDED.rank_in_class,
    class_size = EXCLUDED.class_size,
    is_passed = EXCLUDED.is_passed,
    mention = EXCLUDED.mention,
    mention_color = EXCLUDED.mention_color,
    updated_at = NOW();

  -- Return the persisted results
  SELECT * FROM calculated_results;
END;
$$ LANGUAGE plpgsql;
