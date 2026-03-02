-- =====================================================
-- Diagnostic Rapide : Vérifier Relation Parent-Élève
-- Exécutez ce script après avoir créé un parent pour vérifier
-- si la relation a été créée correctement
-- =====================================================

-- Remplacez cet email par celui du parent créé
DO $$
DECLARE
  v_parent_email VARCHAR := 'fadiala@gmail.com';  -- ← MODIFIER
  v_parent_id UUID;
  v_user_id UUID;
  v_student_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'DIAGNOSTIC PARENT: %', v_parent_email;
  RAISE NOTICE '=====================================================';

  -- 1. Vérifier l'utilisateur dans auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_parent_email;

  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE '✅ 1. Auth User existe: %', v_user_id;
  ELSE
    RAISE NOTICE '❌ 1. Auth User NON TROUVÉ dans auth.users';
  END IF;

  -- 2. Vérifier l'enregistrement users
  IF EXISTS (
    SELECT 1 FROM users WHERE id = v_user_id
  ) THEN
    RAISE NOTICE '✅ 2. Users record existe';
  ELSE
    RAISE NOTICE '❌ 2. Users record NON TROUVÉ pour id=%', v_user_id;
  END IF;

  -- 3. Vérifier l'enregistrement parent
  SELECT id INTO v_parent_id
  FROM parents
  WHERE email = v_parent_email;

  IF v_parent_id IS NOT NULL THEN
    RAISE NOTICE '✅ 3. Parent record existe: %', v_parent_id;
  ELSE
    RAISE NOTICE '❌ 3. Parent record NON TROUVÉ';
  END IF;

  -- 4. Vérifier les relations parent-élève
  SELECT COUNT(*) INTO v_student_count
  FROM student_parent_relations
  WHERE parent_id = v_parent_id;

  IF v_student_count > 0 THEN
    RAISE NOTICE '✅ 4. Relations parent-élève: % relation(s) trouvée(s)', v_student_count;
    RAISE NOTICE '   → Voir les détails dans les requêtes ci-dessous';
  ELSE
    RAISE NOTICE '❌ 4. AUCUNE relation parent-élève trouvée!';
    RAISE NOTICE '   → Le parent n''est lié à AUCUN étudiant';
  END IF;

  -- 5. Vérifier le rôle parent
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id AND r.name = 'parent'
  ) THEN
    RAISE NOTICE '✅ 5. Rôle ''parent'' assigné';
  ELSE
    RAISE NOTICE '❌ 5. Rôle ''parent'' NON ASSIGNÉ';
  END IF;

  -- Résumé
  RAISE NOTICE '';
  IF v_user_id IS NOT NULL AND v_parent_id IS NOT NULL AND v_student_count > 0 THEN
    RAISE NOTICE '🎉 SUCCÈS: Le compte parent est COMPLET et LIÉ aux élèves!';
    RAISE NOTICE '   Le parent peut se connecter et voir ses enfants.';
  ELSE
    RAISE NOTICE '⚠️  PROBLÈME: Le compte parent est INCOMPLET.';
    RAISE NOTICE '   Vérifiez les étapes en erreur ci-dessus.';
  END IF;
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';

END $$;

-- =====================================================
-- Affichage détaillé de toutes les données pour ce parent
-- =====================================================

-- Auth User
SELECT '=== AUTH USER ===' AS section;
SELECT
  id::text,
  email,
  created_at,
  confirmed_at
FROM auth.users
WHERE email = 'fadiala@gmail.com';  -- ← MODIFIER

-- Users Record
SELECT '=== USERS RECORD ===' AS section;
SELECT
  id::text,
  email,
  first_name,
  last_name,
  school_id::text
FROM users
WHERE email = 'fadiala@gmail.com';  -- ← MODIFIER

-- Parent Record
SELECT '=== PARENT RECORD ===' AS section;
SELECT
  id::text,
  email,
  user_id::text,
  school_id::text
FROM parents
WHERE email = 'fadiala@gmail.com';  -- ← MODIFIER

-- Relations avec les enfants
SELECT '=== ENFANTS LIÉS ===' AS section;
SELECT
  p.email AS parent_email,
  s.id::text AS student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  s.matricule,
  spr.relationship,
  spr.is_primary,
  spr.can_view_grades
FROM student_parent_relations spr
JOIN parents p ON p.id = spr.parent_id
JOIN students s ON s.id = spr.student_id
WHERE p.email = 'fadiala@gmail.com'  -- ← MODIFIER
ORDER BY s.last_name, s.first_name;

-- Rôles
SELECT '=== RÔLES ===' AS section;
SELECT
  u.email,
  r.name AS role,
  s.name AS school
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN schools s ON s.id = ur.school_id
WHERE u.email = 'fadiala@gmail.com';  -- ← MODIFIER
