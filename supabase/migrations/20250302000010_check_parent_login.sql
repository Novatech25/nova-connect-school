-- =====================================================
-- Vérifier l'état de connexion des parents
-- Vérifie si les parents peuvent se connecter
-- =====================================================

-- Remplacez par l'email à tester
SELECT '=== ÉTAT DE CONNEXION ===' AS section;

SELECT
  au.email,
  au.id::text AS auth_id,
  au.email_confirmed_at AS email_confirmed,
  au.last_sign_in_at,
  au.created_at,
  au.raw_user_meta_data->>'role' AS role_in_metadata,
  au.raw_user_meta_data,
  CASE
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Email confirmé'
    ELSE '❌ Email NON confirmé - PEUT BLOQUER LA CONNEXION'
  END AS confirmation_status,
  CASE
    WHEN au.raw_user_meta_data->>'role' = 'parent' THEN '✅ Rôle OK'
    ELSE '❌ Rôle manquant'
  END AS role_status
FROM auth.users au
WHERE au.email = 'fadiala@gmail.com';  -- ← MODIFIER

-- Vérifier si l'utilisateur est dans la table users
SELECT '=== USERS TABLE ===' AS section;

SELECT
  u.id::text,
  u.email,
  u.first_name,
  u.last_name,
  u.school_id::text,
  u.created_at
FROM users u
WHERE u.email = 'fadiala@gmail.com';  -- ← MODIFIER

-- Vérifier si le parent existe avec son rôle
SELECT '=== PARENT & ROLE ===' AS section;

SELECT
  p.id::text AS parent_id,
  p.email,
  r.name AS role_assigned,
  ur.school_id::text
FROM parents p
JOIN user_roles ur ON ur.user_id = p.user_id
JOIN roles r ON r.id = ur.role_id
WHERE p.email = 'fadiala@gmail.com';  -- ← MODIFIER

-- Test de diagnostic complet pour tous les parents
SELECT '=== TOUS LES PARENTS - DIAGNOSTIC ===' AS section;

SELECT
  au.email,
  CASE
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅'
    ELSE '❌'
  END AS email_confirmed,
  CASE
    WHEN au.raw_user_meta_data->>'role' = 'parent' THEN '✅'
    ELSE '❌'
  END AS role_ok,
  CASE
    WHEN p.id IS NOT NULL THEN '✅'
    ELSE '❌'
  END AS parent_exists,
  CASE
    WHEN ur.id IS NOT NULL THEN '✅'
    ELSE '❌'
  END AS user_role_exists
FROM auth.users au
LEFT JOIN parents p ON p.email = au.email
LEFT JOIN user_roles ur ON ur.user_id = au.id
WHERE au.raw_user_meta_data->>'role' = 'parent'
ORDER BY au.email;
