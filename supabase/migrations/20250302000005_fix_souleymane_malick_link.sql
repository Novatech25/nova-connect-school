-- =====================================================
-- Script CORRECTION RAPIDE pour Souleymane → Malick
-- Exécuter ce script dans le SQL Editor Supabase
-- =====================================================

-- Ce script va :
-- 1. Trouver l'utilisateur souleymane@gmail.com
-- 2. Créer ou mettre à jour l'enregistrement parent
-- 3. Lier l'utilisateur au parent
-- 4. Créer la relation parent-enfant avec Malick
-- 5. Donner le rôle parent à l'utilisateur

DO $$
DECLARE
  v_user_id UUID;
  v_parent_id UUID;
  v_school_id UUID;
  v_student_id UUID;
  v_role_id UUID;
  v_parent_email VARCHAR := 'souleymane@gmail.com';
BEGIN
  -- 1. Trouver l'utilisateur
  SELECT id INTO v_user_id
  FROM users
  WHERE email = v_parent_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Utilisateur % non trouvé dans la table users', v_parent_email;
  END IF;

  RAISE NOTICE '✅ Utilisateur trouvé: % (ID: %)', v_parent_email, v_user_id;

  -- 2. Trouver l'école de l'utilisateur
  SELECT school_id INTO v_school_id
  FROM users
  WHERE id = v_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION '❌ L''utilisateur n''a pas d''école assignée';
  END IF;

  RAISE NOTICE '✅ École ID: %', v_school_id;

  -- 3. Trouver l'étudiant Malick
  SELECT id INTO v_student_id
  FROM students
  WHERE first_name ILIKE 'Malick'
  AND school_id = v_school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION '❌ Étudiant Malick non trouvé dans l''école %', v_school_id;
  END IF;

  RAISE NOTICE '✅ Étudiant Malick trouvé (ID: %)', v_student_id;

  -- 4. Créer ou mettre à jour l'enregistrement parent
  -- Vérifier si le parent existe déjà
  SELECT id INTO v_parent_id
  FROM parents
  WHERE school_id = v_school_id
  AND email = v_parent_email
  LIMIT 1;

  IF v_parent_id IS NOT NULL THEN
    -- Le parent existe, mettre à jour user_id
    UPDATE parents
    SET user_id = v_user_id
    WHERE id = v_parent_id;
    RAISE NOTICE '✅ Parent existant mis à jour (ID: %)', v_parent_id;
  ELSE
    -- Créer un nouveau parent
    -- Récupérer first_name et last_name depuis la table users (pas auth.users)
    INSERT INTO parents (
      school_id,
      user_id,
      first_name,
      last_name,
      email,
      phone,
      relationship,
      is_primary_contact,
      is_emergency_contact
    )
    SELECT
      v_school_id,
      v_user_id,
      u.first_name,
      u.last_name,
      v_parent_email,
      '0000000',  -- Phone par défaut
      'Père',
      TRUE,
      TRUE
    FROM users u
    WHERE u.id = v_user_id
    RETURNING parents.id INTO v_parent_id;

    RAISE NOTICE '✅ Nouveau parent créé (ID: %)', v_parent_id;
  END IF;

  RAISE NOTICE '✅ Parent créé/mis à jour (ID: %)', v_parent_id;

  -- 5. Vérifier si la relation existe déjà
  IF NOT EXISTS (
    SELECT 1 FROM student_parent_relations
    WHERE parent_id = v_parent_id
    AND student_id = v_student_id
  ) THEN
    -- Créer la relation parent-enfant
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
      'Père',
      TRUE,
      TRUE,
      TRUE,
      TRUE
    );

    RAISE NOTICE '✅ Relation parent-enfant créée';
  ELSE
    RAISE NOTICE 'ℹ️  Relation parent-enfant existe déjà';
  END IF;

  -- 6. Donner le rôle parent à l'utilisateur
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = 'parent'
  LIMIT 1;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, school_id)
    VALUES (v_user_id, v_role_id, v_school_id)
    ON CONFLICT (user_id, role_id, school_id) DO NOTHING;

    RAISE NOTICE '✅ Rôle parent attribué à l''utilisateur';
  END IF;

  -- 7. Résumé
  RAISE NOTICE '';
  RAISE NOTICE '🎉 SUCCÈS ! Configuration terminée:';
  RAISE NOTICE '   User ID: %', v_user_id;
  RAISE NOTICE '   Parent ID: %', v_parent_id;
  RAISE NOTICE '   Student ID (Malick): %', v_student_id;
  RAISE NOTICE '   School ID: %', v_school_id;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Souleymane peut maintenant se connecter et voir les notes de Malick !';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: Déconnectez-vous et reconnectez-vous pour appliquer les changements.';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERREUR: %', SQLERRM;
    RAISE NOTICE 'Vérifiez que:';
    RAISE NOTICE '1. L''utilisateur souleymane@gmail.com existe dans users';
    RAISE NOTICE '2. L''étudiant Malick existe dans students';
    RAISE NOTICE '3. Les deux appartiennent à la même école';
END $$;

-- =====================================================
-- Vérification finale
-- =====================================================

SELECT
  'Vérification de la configuration:' AS info;

-- Afficher l'utilisateur et son rôle
SELECT
  u.email,
  u.first_name,
  u.last_name,
  r.name AS role,
  u.school_id
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'souleymane@gmail.com';

-- Afficher le parent
SELECT
  p.id AS parent_id,
  p.first_name,
  p.last_name,
  p.email,
  p.user_id,
  p.school_id
FROM parents p
WHERE p.email = 'souleymane@gmail.com';

-- Afficher les relations
SELECT
  spr.id AS relation_id,
  p.email AS parent_email,
  s.first_name || ' ' || s.last_name AS student_name,
  s.matricule,
  spr.relationship,
  spr.can_view_grades
FROM student_parent_relations spr
JOIN parents p ON p.id = spr.parent_id
JOIN students s ON s.id = spr.student_id
WHERE p.email = 'souleymane@gmail.com';
