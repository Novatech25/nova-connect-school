-- =====================================================
-- Script de Diagnostic pour le Parent Malick
-- Exécuter ce script dans le SQL Editor Supabase pour vérifier les données
-- =====================================================

-- Remplacer ceci par l'email du parent Malick
-- Par exemple: 'parent_malick@test.com' ou l'email que vous utilisez pour vous connecter
DO $$
DECLARE
  v_parent_email TEXT := 'souleymane@gmail.com';  -- ← MODIFIER avec l'email réel du parent
  v_user_id UUID;
  v_parent_id UUID;
  v_student_id UUID;
  v_relation_count INTEGER;
BEGIN
  -- 1. Trouver l'utilisateur parent par email
  SELECT id INTO v_user_id
  FROM users
  WHERE email = v_parent_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ Aucun utilisateur trouvé avec l''email: %', v_parent_email;
    RAISE NOTICE '→ Veuillez vérifier l''email et réexécuter ce script';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Utilisateur trouvé: % (ID: %)', v_parent_email, v_user_id;

  -- 2. Vérifier si le parent existe dans la table parents
  SELECT id INTO v_parent_id
  FROM parents
  WHERE user_id = v_user_id;

  IF v_parent_id IS NULL THEN
    RAISE NOTICE '❌ Aucun enregistrement parent trouvé pour cet utilisateur';
    RAISE NOTICE '→ Le parent n''existe pas dans la table "parents"';
    RAISE NOTICE '→ Solution: Créer un enregistrement parent pour cet utilisateur';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Parent trouvé dans la table parents (ID: %)', v_parent_id;

  -- 3. Trouver l'étudiant Malick
  SELECT id INTO v_student_id
  FROM students
  WHERE first_name ILIKE 'Malick'
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE NOTICE '⚠️  Aucun étudiant nommé "Malick" trouvé';
    RAISE NOTICE '→ Vérifier le nom de l''étudiant';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Étudiant Malick trouvé (ID: %)', v_student_id;

  -- 4. Vérifier les relations parent-enfant
  SELECT COUNT(*) INTO v_relation_count
  FROM student_parent_relations
  WHERE parent_id = v_parent_id;

  IF v_relation_count = 0 THEN
    RAISE NOTICE '❌ AUCUNE relation parent-enfant trouvée !';
    RAISE NOTICE '→ Le parent % n''est lié à AUCUN étudiant', v_parent_email;
    RAISE NOTICE '→ Parent ID: %', v_parent_id;
    RAISE NOTICE '→ Étudiant Malick ID: %', v_student_id;
    RAISE NOTICE '';
    RAISE NOTICE '🔧 SOLUTION: Exécuter le script 20250302000003_fix_parent_malick_relation.sql';
  ELSE
    RAISE NOTICE '✅ Le parent a % relation(s) parent-enfant', v_relation_count;

    -- 5. Vérifier si Malick est lié à ce parent
    IF EXISTS (
      SELECT 1 FROM student_parent_relations
      WHERE parent_id = v_parent_id
      AND student_id = v_student_id
    ) THEN
      RAISE NOTICE '✅ Malick EST lié à ce parent';
    ELSE
      RAISE NOTICE '⚠️  Malick n''est PAS lié à ce parent';
      RAISE NOTICE '→ Le parent a des enfants, mais Malick n''en fait pas partie';
    END IF;
  END IF;

END $$;

-- =====================================================
-- Afficher toutes les relations parent-enfant existantes
-- =====================================================
SELECT
  p.first_name || ' ' || p.last_name AS parent_name,
  p.email AS parent_email,
  s.first_name || ' ' || s.last_name AS student_name,
  s.matricule,
  spr.relationship
FROM student_parent_relations spr
JOIN parents p ON p.id = spr.parent_id
JOIN students s ON s.id = spr.student_id
ORDER BY p.last_name, s.last_name;

-- =====================================================
-- Afficher tous les parents (pour vérifier les emails)
-- =====================================================
SELECT
  id,
  first_name,
  last_name,
  email,
  user_id,
  school_id
FROM parents
ORDER BY last_name, first_name;
