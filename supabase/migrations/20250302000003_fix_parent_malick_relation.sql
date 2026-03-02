-- =====================================================
-- Script de Correction - Lier le parent Malick à l'étudiant Malick
-- À exécuter APRES avoir vérifié avec le script de diagnostic
-- =====================================================

-- ⚠️  IMPORTANT: Remplacer par les valeurs réelles trouvées dans le diagnostic
DO $$
DECLARE
  v_parent_email TEXT := 'souleymane@gmail.com';  -- ← MODIFIER avec l'email réel du parent
  v_student_name TEXT := 'Malick';                   -- ← MODIFIER si le nom est différent
  v_relationship TEXT := 'Père';                     -- ← Peut être 'Père', 'Mère', 'Tuteur', etc.

  v_user_id UUID;
  v_parent_id UUID;
  v_school_id UUID;
  v_student_id UUID;
  v_existing_relation INTEGER;
BEGIN
  -- 1. Trouver l'utilisateur parent
  SELECT id INTO v_user_id
  FROM users
  WHERE email = v_parent_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Utilisateur parent non trouvé avec l''email: %', v_parent_email;
  END IF;

  RAISE NOTICE '✅ Utilisateur trouvé: %', v_parent_email;

  -- 2. Vérifier si le parent existe (par user_id ou par email)
  SELECT id, school_id INTO v_parent_id, v_school_id
  FROM parents
  WHERE (user_id = v_user_id OR email = v_parent_email)
  AND school_id = (SELECT school_id FROM users WHERE id = v_user_id LIMIT 1)
  LIMIT 1;

  IF v_parent_id IS NOT NULL THEN
    -- Parent existe, mettre à jour user_id si NULL
    UPDATE parents
    SET user_id = COALESCE(user_id, v_user_id)
    WHERE id = v_parent_id;

    RAISE NOTICE '✅ Enregistrement parent trouvé et mis à jour (ID: %)', v_parent_id;
  ELSE
    -- Créer l'enregistrement parent s'il n'existe pas
    INSERT INTO parents (school_id, user_id, first_name, last_name, email, phone, relationship, is_primary_contact, is_emergency_contact)
    SELECT
      (SELECT school_id FROM users WHERE id = v_user_id LIMIT 1),
      v_user_id,
      (SELECT raw_user_meta_data->>'firstName' FROM auth.users WHERE id = v_user_id),
      (SELECT raw_user_meta_data->>'lastName' FROM auth.users WHERE id = v_user_id),
      v_parent_email,
      '0000000',  -- Phone par défaut
      v_relationship,
      TRUE,
      TRUE
    RETURNING parents.id, parents.school_id INTO v_parent_id, v_school_id;

    RAISE NOTICE '✅ Enregistrement parent créé (ID: %)', v_parent_id;
  END IF;

  -- 3. Trouver l'étudiant
  SELECT id INTO v_student_id
  FROM students
  WHERE first_name ILIKE v_student_name
  AND school_id = v_school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '❌ Étudiant "%" non trouvé dans l''école %', v_student_name, v_school_id;
  END IF;

  RAISE NOTICE '✅ Étudiant trouvé: % (ID: %)', v_student_name, v_student_id;

  -- 4. Vérifier si la relation existe déjà
  SELECT COUNT(*) INTO v_existing_relation
  FROM student_parent_relations
  WHERE parent_id = v_parent_id
  AND student_id = v_student_id;

  IF v_existing_relation > 0 THEN
    RAISE NOTICE '⚠️  La relation existe déjà ! Pas de création nécessaire.';
    RETURN;
  END IF;

  -- 5. Créer la relation parent-enfant
  INSERT INTO student_parent_relations (
    school_id,
    parent_id,
    student_id,
    relationship,
    is_primary,
    can_pickup,
    can_view_grades,
    can_view_attendance
  ) VALUES (
    v_school_id,
    v_parent_id,
    v_student_id,
    v_relationship,
    true,      -- is_primary
    true,      -- can_pickup
    true,      -- can_view_grades
    true       -- can_view_attendance
  );

  RAISE NOTICE '';
  RAISE NOTICE '🎉 SUCCÈS ! Relation parent-enfant créée:';
  RAISE NOTICE '   Parent: % (ID: %)', v_parent_email, v_parent_id;
  RAISE NOTICE '   Étudiant: % (ID: %)', v_student_name, v_student_id;
  RAISE NOTICE '   Relation: %', v_relationship;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Le parent devrait maintenant voir les notes de l''étudiant !';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERREUR: %', SQLERRM;
    RAISE NOTICE '→ Vérifiez les paramètres et réessayez';
END $$;

-- =====================================================
-- Vérification - Afficher la nouvelle relation
-- =====================================================
SELECT
  p.email AS parent_email,
  p.first_name || ' ' || p.last_name AS parent_full_name,
  s.first_name || ' ' || s.last_name AS student_full_name,
  s.matricule,
  spr.relationship,
  spr.is_primary,
  spr.can_view_grades
FROM student_parent_relations spr
JOIN parents p ON p.id = spr.parent_id
JOIN students s ON s.id = spr.student_id
WHERE p.email = 'parent_malick@test.com'  -- ← Modifier avec l'email réel
ORDER BY s.last_name, s.first_name;
