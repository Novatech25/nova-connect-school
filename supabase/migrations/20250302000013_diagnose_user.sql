-- =====================================================
-- Diagnostic complet pour un email
-- Vérifie si l'utilisateur existe partout
-- =====================================================

-- Remplacez par l'email à diagnostiquer
SELECT '=== DIAGNOSTIC COMPLET POUR: altman25@gmail.com ===' AS section;

-- 1. Vérifier dans auth.users
SELECT '=== AUTH.USERS ===' AS section;
SELECT
  id::text,
  email,
  created_at,
  email_confirmed_at,
  raw_user_meta_data,
  CASE
    WHEN id IS NOT NULL THEN '✅ Existe dans auth.users'
    ELSE '❌ N''existe PAS dans auth.users - PROBLÈME !'
  END AS status
FROM auth.users
WHERE email = 'altman25@gmail.com';  -- ← MODIFIER

-- 2. Vérifier dans users
SELECT '=== USERS TABLE ===' AS section;
SELECT
  id::text,
  email,
  first_name,
  last_name,
  school_id::text,
  CASE
    WHEN id IS NOT NULL THEN '✅ Existe dans users'
    ELSE '❌ N''existe PAS dans users'
  END AS status
FROM users
WHERE email = 'altman25@gmail.com';  -- ← MODIFIER

-- 3. Vérifier dans parents
SELECT '=== PARENTS TABLE ===' AS section;
SELECT
  id::text,
  email,
  user_id::text,
  school_id::text,
  CASE
    WHEN id IS NOT NULL THEN '✅ Existe dans parents'
    ELSE '❌ N''existe PAS dans parents'
  END AS status
FROM parents
WHERE email = 'altman25@gmail.com';  -- ← MODIFIER

-- 4. Résumé
SELECT '=== RÉSUMÉ ===' AS section;
SELECT
  COALESCE(au.id::text, 'NON') AS auth_user,
  COALESCE(u.id::text, 'NON') AS users_table,
  COALESCE(p.id::text, 'NON') AS parents_table,
  COALESCE(ur.id::text, 'NON') AS user_role,
  CASE
    WHEN au.id IS NOT NULL AND u.id IS NOT NULL AND p.id IS NOT NULL THEN '✅ COMPTE COMPLET'
    WHEN au.id IS NULL THEN '❌ MANQUE auth.users - COMPTE NON CRÉÉ'
    WHEN u.id IS NULL THEN '❌ MANQUE users record'
    WHEN p.id IS NULL THEN '❌ MANQUE parents record'
    ELSE '⚠️  INCOMPLET'
  END AS status
FROM (SELECT 'altman25@gmail.com'::varchar AS email) AS dummy
LEFT JOIN auth.users au ON au.email = 'altman25@gmail.com'
LEFT JOIN users u ON u.email = 'altman25@gmail.com'
LEFT JOIN parents p ON p.email = 'altman25@gmail.com'
LEFT JOIN user_roles ur ON ur.user_id = u.id;
