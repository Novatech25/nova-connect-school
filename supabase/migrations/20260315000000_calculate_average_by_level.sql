-- Migration: Différenciation des moyennes (Devoirs vs Examen) pour le Collège et le Lycée
-- Fonctionnalité: 
-- 1. Récupération du type de niveau (primaire, collège, lycée)
-- 2. Scission des notes selon grade_type ('homework', 'quiz', 'project', 'participation' -> Moyenne Devoirs)
-- 3. Selon 'exam', 'composition' -> Moyenne Examen
-- 4. Si Collège ou Lycée -> (Moy Devoirs + Moy Examen) / 2
-- 5. Sinon -> Calcul global pondéré classique

-- Fonction calculate_class_rankings modifiée
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
  v_level_type VARCHAR(50);
BEGIN
  -- 1. Obtenir l'année académique de la période
  SELECT p.academic_year_id
  INTO v_academic_year_id
  FROM periods p
  WHERE p.id = p_period_id;

  IF v_academic_year_id IS NULL THEN
    RAISE EXCEPTION 'Period not found';
  END IF;

  -- 2. Obtenir la taille de la classe
  SELECT COUNT(*)
  INTO v_class_size
  FROM enrollments
  WHERE class_id = p_class_id
    AND academic_year_id = v_academic_year_id;

  -- 3. Obtenir le type de niveau (level_type)
  SELECT l.level_type INTO v_level_type
  FROM classes c
  JOIN levels l ON l.id = c.level_id
  WHERE c.id = p_class_id;

  -- Requête principale
  RETURN QUERY
  WITH enrolled_students AS (
    SELECT DISTINCT e.student_id
    FROM enrollments e
    WHERE e.class_id = p_class_id
      AND e.academic_year_id = v_academic_year_id
  ),
  subject_level_grades AS (
    SELECT
      es.student_id,
      g.subject_id,
      s.coefficient as subject_coef,
      SUM(CASE WHEN g.grade_type IN ('homework', 'quiz', 'project', 'participation') THEN (g.score / g.max_score) * 20 * g.coefficient ELSE 0 END) as hw_score_sum,
      SUM(CASE WHEN g.grade_type IN ('homework', 'quiz', 'project', 'participation') THEN g.coefficient ELSE 0 END) as hw_coef_sum,
      SUM(CASE WHEN g.grade_type IN ('exam', 'composition') THEN (g.score / g.max_score) * 20 * g.coefficient ELSE 0 END) as ex_score_sum,
      SUM(CASE WHEN g.grade_type IN ('exam', 'composition') THEN g.coefficient ELSE 0 END) as ex_coef_sum,
      SUM((g.score / g.max_score) * 20 * g.coefficient) as total_score_sum,
      SUM(g.coefficient) as total_coef_sum
    FROM enrolled_students es
    LEFT JOIN grades g ON g.student_id = es.student_id
      AND g.period_id = p_period_id
      AND g.status = 'published'
    LEFT JOIN subjects s ON s.id = g.subject_id
    GROUP BY es.student_id, g.subject_id, s.coefficient
  ),
  student_subject_averages AS (
    SELECT
      slg.student_id,
      slg.subject_id,
      slg.subject_coef,
      CASE
        WHEN v_level_type IN ('middle_school', 'high_school') THEN
          CASE
            WHEN slg.hw_coef_sum > 0 AND slg.ex_coef_sum > 0 THEN ((slg.hw_score_sum / slg.hw_coef_sum) + (slg.ex_score_sum / slg.ex_coef_sum)) / 2.0
            WHEN slg.ex_coef_sum > 0 THEN ((slg.ex_score_sum / slg.ex_coef_sum) + (slg.ex_score_sum / slg.ex_coef_sum)) / 2.0 -- Le devoir hérite de l'examen si absent
            WHEN slg.hw_coef_sum > 0 THEN (slg.hw_score_sum / slg.hw_coef_sum)
            ELSE 0
          END
        ELSE
          COALESCE(slg.total_score_sum / NULLIF(slg.total_coef_sum, 0), 0)
      END as subject_average
    FROM subject_level_grades slg
    WHERE slg.total_coef_sum > 0 -- L'élève a au moins eu 1 note dans cette matière
  ),
  student_averages AS (
    SELECT
      ssa.student_id,
      COALESCE(SUM(ssa.subject_average * ssa.subject_coef) / NULLIF(SUM(ssa.subject_coef), 0), 0) as avg
    FROM student_subject_averages ssa
    GROUP BY ssa.student_id
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
  SELECT 
    rs.student_id, 
    rs.overall_average::DECIMAL(5,2), 
    rs.rank, 
    rs.class_size 
  FROM ranked_students rs;
END;
$$ LANGUAGE plpgsql;


-- Fonction generate_report_card_data modifiée
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
  v_level_type VARCHAR(50);
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

  -- Choix de l'échelle de notation
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

  -- Type de niveau pour le calcul distinct Devoirs / Examens
  SELECT l.level_type INTO v_level_type
  FROM classes c
  JOIN levels l ON l.id = c.level_id
  WHERE c.id = v_class_id;

  -- Calcul structuré des moyennes
  WITH raw_subject_grades AS (
    SELECT
      s.id as subject_id,
      s.name as subject_name,
      s.coefficient as total_coefficient,
      SUM(CASE WHEN g.grade_type IN ('homework', 'quiz', 'project', 'participation') THEN (g.score / g.max_score) * 20 * g.coefficient ELSE 0 END) as hw_score_sum,
      SUM(CASE WHEN g.grade_type IN ('homework', 'quiz', 'project', 'participation') THEN g.coefficient ELSE 0 END) as hw_coef_sum,
      SUM(CASE WHEN g.grade_type IN ('exam', 'composition') THEN (g.score / g.max_score) * 20 * g.coefficient ELSE 0 END) as ex_score_sum,
      SUM(CASE WHEN g.grade_type IN ('exam', 'composition') THEN g.coefficient ELSE 0 END) as ex_coef_sum,
      SUM((g.score / g.max_score) * 20 * g.coefficient) as total_score_sum,
      SUM(g.coefficient) as total_coef_sum,
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
  ),
  processed_subject_data AS (
    SELECT
      subject_id,
      subject_name,
      total_coefficient,
      grade_count,
      (
        CASE
          WHEN v_level_type IN ('middle_school', 'high_school') AND (hw_coef_sum IS NULL OR hw_coef_sum = 0) AND ex_coef_sum > 0 THEN COALESCE(ex_score_sum / NULLIF(ex_coef_sum, 0), NULL)
          ELSE COALESCE(hw_score_sum / NULLIF(hw_coef_sum, 0), NULL)
        END
      ) as homework_avg,
      COALESCE(ex_score_sum / NULLIF(ex_coef_sum, 0), NULL) as exam_avg,
      (
        CASE
          WHEN v_level_type IN ('middle_school', 'high_school') THEN
            CASE
              WHEN hw_coef_sum > 0 AND ex_coef_sum > 0 THEN ((hw_score_sum / hw_coef_sum) + (ex_score_sum / ex_coef_sum)) / 2.0
              WHEN ex_coef_sum > 0 THEN ((ex_score_sum / ex_coef_sum) + (ex_score_sum / ex_coef_sum)) / 2.0 -- Le devoir hérite de l'examen si absent
              WHEN hw_coef_sum > 0 THEN (hw_score_sum / hw_coef_sum)
              ELSE 0
            END
          ELSE
            COALESCE(total_score_sum / NULLIF(total_coef_sum, 0), 0)
        END
      )::DECIMAL(5,2) as final_average
    FROM raw_subject_grades
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'subjectId', subject_id,
      'subjectName', subject_name,
      'average', final_average,
      'homeworkAverage', homework_avg::DECIMAL(5,2),
      'examAverage', exam_avg::DECIMAL(5,2),
      'coefficient', total_coefficient,
      'gradeCount', grade_count
    )
  )
  INTO v_subject_avgs
  FROM processed_subject_data;

  v_subject_avgs := COALESCE(v_subject_avgs, '[]'::jsonb);

  -- Calcul de la moyenne globale
  SELECT COALESCE(
    SUM((elem->>'average')::DECIMAL * (elem->>'coefficient')::DECIMAL) /
    NULLIF(SUM((elem->>'coefficient')::DECIMAL), 0),
    0
  )
  INTO v_overall_avg
  FROM jsonb_array_elements(v_subject_avgs) elem;

  -- Rangs (se base sur le calcul symétrique dans calculate_class_rankings)
  SELECT r.rank, r.class_size
  INTO v_rank, v_class_size
  FROM calculate_class_rankings(v_class_id, p_period_id) r
  WHERE r.student_id = p_student_id;

  -- Mention
  SELECT m.mention_label, m.mention_color
  INTO v_mention, v_mention_color
  FROM get_mention_for_average(v_overall_avg, v_grading_scale_id) m;

  RETURN QUERY
  SELECT
    p_student_id,
    v_class_id,
    v_academic_year_id,
    v_grading_scale_id,
    v_overall_avg::DECIMAL(5,2),
    v_rank,
    v_class_size,
    v_mention,
    v_mention_color,
    v_subject_avgs;
END;
$$ LANGUAGE plpgsql;
