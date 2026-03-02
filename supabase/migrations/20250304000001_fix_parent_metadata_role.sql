-- =====================================================
-- Fix: Ensure parent role is in both user_metadata and app_metadata
-- Repairs existing parent accounts created with incomplete metadata
-- =====================================================

-- Vérifier les parents qui n'ont pas le rôle correct
SELECT '=== PARENTS SANS RÔLE CORRECT ===' AS section;

SELECT
  u.id::text AS user_id,
  u.email,
  au.raw_user_meta_data->>'role' AS metadata_role,
  au.raw_app_meta_data->>'role' AS app_metadata_role,
  r.name AS db_role,
  CASE
    WHEN (au.raw_user_meta_data->>'role' = 'parent' OR au.raw_app_meta_data->>'role' = 'parent') THEN '✅ OK'
    ELSE '❌ À réparer'
  END AS status
FROM users u
JOIN auth.users au ON au.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'parent'
  AND (au.raw_user_meta_data->>'role' IS NULL
       OR au.raw_user_meta_data->>'role' != 'parent'
       OR au.raw_app_meta_data->>'role' IS NULL
       OR au.raw_app_meta_data->>'role' != 'parent');

-- Mettre à jour user_metadata pour tous les parents
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role', 'parent',
  'provider', 'email'
)
WHERE id IN (
  SELECT u.id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'parent'
    AND (raw_user_meta_data->>'role' IS NULL OR raw_user_meta_data->>'role' != 'parent')
);

-- Mettre à jour app_metadata pour tous les parents
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role', 'parent',
  'provider', 'email'
)
WHERE id IN (
  SELECT u.id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'parent'
    AND (raw_app_meta_data->>'role' IS NULL OR raw_app_meta_data->>'role' != 'parent')
);

-- Vérifier après mise à jour
SELECT '=== VÉRIFICATION APRÈS RÉPARATION ===' AS section;

SELECT
  u.email,
  au.raw_user_meta_data->>'role' AS user_metadata_role,
  au.raw_app_meta_data->>'role' AS app_metadata_role,
  r.name AS db_role,
  CASE
    WHEN (au.raw_user_meta_data->>'role' = 'parent' OR au.raw_app_meta_data->>'role' = 'parent') THEN '✅ OK'
    ELSE '❌ PROBLÈME'
  END AS status
FROM users u
JOIN auth.users au ON au.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'parent'
ORDER BY u.email;
