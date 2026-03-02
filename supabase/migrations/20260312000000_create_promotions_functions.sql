-- ============================================================================
-- MODULE: Promotions des élèves
-- DESCRIPTION: Fonctions RPC pour évaluer l'éligibilité et appliquer les promotions
-- DATE: 2026-03-01
-- ============================================================================

-- ============================================================================
-- 1. get_promotion_eligibility
-- Calcule l'éligibilité à la promotion pour tous les élèves d'une école pour une année donnée
-- ============================================================================
DROP FUNCTION IF EXISTS get_promotion_eligibility(UUID, UUID);

CREATE OR REPLACE FUNCTION get_promotion_eligibility(
  p_school_id UUID,
  p_current_year_id UUID
)
RETURNS TABLE (
  "studentId" UUID,
  "studentFirstName" TEXT,
  "studentLastName" TEXT,
  "studentMatricule" TEXT,
  "currentClassId" UUID,
  "currentClassName" TEXT,
  "currentLevelId" UUID,
  "currentLevelName" TEXT,
  "nextLevelId" UUID,
  "nextLevelName" TEXT,
  "finalAverage" DECIMAL(5,2),
  "passingScore" DECIMAL(5,2),
  "rankInClass" INTEGER,
  "isEligibleForPromotion" BOOLEAN,
  "hasEnrollmentNextYear" BOOLEAN,
  "suggestion" TEXT
) AS $$
DECLARE
  v_passing_score DECIMAL(5,2);
BEGIN
  -- Obtenir le seuil de passage par défaut de l'école (si défini dans les settings)
  -- Pour simplifier, on prendra 10 par défaut si non trouvé.
  v_passing_score := 10.00;

  RETURN QUERY
  WITH student_enrollments AS (
    -- On cible toutes les inscriptions de l'année en cours
    SELECT 
      e.student_id,
      e.class_id,
      c.name as class_name,
      c.level_id as level_id,
      l.name as level_name,
      nl.id as next_level_id,
      nl.name as next_level_name,
      s.first_name,
      s.last_name,
      s.matricule
    FROM enrollments e
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN levels l ON l.id = c.level_id
    LEFT JOIN levels nl ON nl.school_id = l.school_id AND nl.level_type = l.level_type AND nl.order_index = l.order_index + 1
    LEFT JOIN students s ON s.id = e.student_id
    WHERE e.academic_year_id = p_current_year_id
      -- Assouplissement majeur : on inclut les pending si les écoles ne finalisent pas
      AND e.status IN ('enrolled', 'completed', 'pending')
      AND (c.school_id = p_school_id OR e.school_id = p_school_id)
  ),
  student_averages AS (
    SELECT 
      se.student_id,
      -- Protection totale contre la division par zéro et les sommes nulles
      CASE 
        WHEN SUM(COALESCE(sub.coefficient, 1)) > 0 AND COUNT(g.id) > 0 THEN
          (SUM( (g.score / g.max_score) * 20.0 * COALESCE(sub.coefficient, 1) ) / SUM(COALESCE(sub.coefficient, 1)))
        ELSE NULL
      END as overall_avg
    FROM student_enrollments se
    LEFT JOIN grades g ON g.student_id = se.student_id AND g.status = 'published' AND g.academic_year_id = p_current_year_id
    LEFT JOIN subjects sub ON sub.id = g.subject_id
    GROUP BY se.student_id
  ),
  student_ranks AS (
    -- Calcul du rang basé sur la moyenne globale de la classe
    SELECT 
      sa.student_id,
      sa.overall_avg,
      CASE 
        WHEN sa.overall_avg IS NOT NULL THEN 
          RANK() OVER (PARTITION BY se.class_id ORDER BY sa.overall_avg DESC)
        ELSE NULL 
      END as rank
    FROM student_averages sa
    JOIN student_enrollments se ON se.student_id = sa.student_id
  )
  SELECT 
    se.student_id as "studentId",
    se.first_name::TEXT as "studentFirstName",
    se.last_name::TEXT as "studentLastName",
    se.matricule::TEXT as "studentMatricule",
    se.class_id as "currentClassId",
    se.class_name::TEXT as "currentClassName",
    se.level_id as "currentLevelId",
    se.level_name::TEXT as "currentLevelName",
    se.next_level_id as "nextLevelId",
    se.next_level_name::TEXT as "nextLevelName",
    sr.overall_avg::DECIMAL(5,2) as "finalAverage",
    v_passing_score::DECIMAL(5,2) as "passingScore",
    sr.rank::INTEGER as "rankInClass",
    CASE WHEN sr.overall_avg IS NOT NULL AND sr.overall_avg >= v_passing_score THEN true ELSE false END as "isEligibleForPromotion",
    -- Vérification si l'élève a déjà une inscription pour une AUTRE année que l'année courante 
    -- et qui débute après l'année courante (simplification: toute inscription qui n'est pas dans l'année courante)
    EXISTS (
      SELECT 1 FROM enrollments next_e 
      JOIN academic_years ay ON ay.id = next_e.academic_year_id
      WHERE next_e.student_id = se.student_id 
        AND next_e.academic_year_id != p_current_year_id
        AND ay.start_date > (SELECT start_date FROM academic_years WHERE id = p_current_year_id LIMIT 1)
    ) as "hasEnrollmentNextYear",
    -- Détermination automatique du statut
    CASE 
      WHEN sr.overall_avg IS NULL THEN 'En attente des notes'::TEXT
      WHEN sr.overall_avg >= v_passing_score THEN 'Promouvoir'::TEXT
      WHEN sr.overall_avg >= (v_passing_score - 0.5) THEN 'À considérer'::TEXT
      ELSE 'Redoublement conseillé'::TEXT
    END as "suggestion"
  FROM student_enrollments se
  LEFT JOIN student_ranks sr ON sr.student_id = se.student_id
  ORDER BY se.class_name ASC, sr.rank ASC NULLS LAST, se.last_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. promote_students_bulk
-- Effectue la promotion ou le redoublement en masse des élèves
-- ============================================================================
CREATE OR REPLACE FUNCTION promote_students_bulk(
  p_school_id UUID,
  p_current_year_id UUID,
  p_next_year_id UUID,
  p_promotions JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_promotion JSONB;
  v_student_id UUID;
  v_target_class_id UUID;
  v_is_repeating BOOLEAN;
  v_annual_tuition DECIMAL(12, 2);
  v_result JSONB := '[]'::JSONB;
  v_success BOOLEAN;
  v_error_msg TEXT;
  v_new_enrollment_id UUID;
BEGIN
  -- Boucle sur chaque objet "promotion" dans le tableau p_promotions
  FOR v_promotion IN SELECT * FROM jsonb_array_elements(p_promotions)
  LOOP
    v_student_id := (v_promotion->>'studentId')::UUID;
    v_target_class_id := NULL;
    v_is_repeating := COALESCE((v_promotion->>'isRepeating')::BOOLEAN, FALSE);
    v_annual_tuition := (v_promotion->>'annualTuitionAmount')::DECIMAL;
    v_success := TRUE;
    v_error_msg := NULL;

    BEGIN
      -- Si le paramète 'targetClassId' est valide et est un ID de Table 'classes' (UUID de classe)
      IF EXISTS (SELECT 1 FROM classes WHERE id = (v_promotion->>'targetClassId')::UUID) THEN
        v_target_class_id := (v_promotion->>'targetClassId')::UUID;
      ELSE
        -- S'il s'agit d'un LEVEL_ID, chercher la première classe disponible dans ce niveau pour cette école
        -- et pour l'année académique cible
        SELECT id INTO v_target_class_id 
        FROM classes 
        WHERE level_id = (v_promotion->>'targetClassId')::UUID 
          AND school_id = p_school_id 
          AND academic_year_id = p_next_year_id
        ORDER BY name ASC 
        LIMIT 1;
        
        IF v_target_class_id IS NULL THEN
          RAISE EXCEPTION 'Aucune classe disponible dans le niveau ciblé pour l''année suivante';
        END IF;
      END IF;

      -- Vérifier si l'étudiant est déjà inscrit pour la prochaine année
      IF EXISTS (
        SELECT 1 FROM enrollments 
        WHERE student_id = v_student_id AND academic_year_id = p_next_year_id
      ) THEN
        RAISE EXCEPTION 'Déjà inscrit pour cette année académique';
      END IF;

      -- Fermer l'inscription courante (la passer de 'enrolled' à 'completed')
      UPDATE enrollments 
      SET status = 'completed', updated_at = NOW()
      WHERE student_id = v_student_id 
        AND academic_year_id = p_current_year_id;

      -- Créer la nouvelle inscription
      INSERT INTO enrollments (
        school_id, 
        student_id, 
        academic_year_id, 
        class_id, 
        status, 
        enrollment_date, 
        is_repeating,
        annual_tuition_amount
      ) VALUES (
        p_school_id, 
        v_student_id, 
        p_next_year_id, 
        v_target_class_id, 
        'enrolled', 
        CURRENT_DATE, 
        v_is_repeating,
        v_annual_tuition
      ) RETURNING id INTO v_new_enrollment_id;

      -- On insère le succès à ce stade
      v_result := v_result || jsonb_build_object(
        'studentId', v_student_id,
        'success', true,
        'message', 'Promotion réussie',
        'error', null
      );

    EXCEPTION WHEN OTHERS THEN
      v_success := FALSE;
      v_error_msg := SQLERRM;
      
      v_result := v_result || jsonb_build_object(
        'studentId', v_student_id,
        'success', false,
        'message', v_error_msg,
        'error', v_error_msg
      );
    END;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_promotion_eligibility(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_students_bulk(UUID, UUID, UUID, JSONB) TO authenticated;
