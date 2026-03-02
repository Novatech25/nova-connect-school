-- =====================================================
-- Fix Parent Role Metadata
-- Corrige le rôle manquant dans user_metadata pour les parents
-- =====================================================

-- Vérifier les parents qui n'ont pas le rôle dans user_metadata
SELECT
  u.id::text,
  u.email,
  au.raw_user_meta_data->>'role' AS current_role_in_metadata,
  r.name AS role_from_table
FROM users u
JOIN auth.users au ON au.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'parent'
  AND (au.raw_user_meta_data->>'role' IS NULL OR au.raw_user_meta_data->>'role' != 'parent');

-- Mettre à jour le rôle dans user_metadata pour tous les parents
-- IMPORTANT: Exécutez cette commande SEULEMENT si la première requête montre des parents sans rôle
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "parent"}'::jsonb
WHERE id IN (
  SELECT u.id
  FROM users u
  JOIN user_roles ur ON ur.user_id = u.id
  JOIN roles r ON r.id = ur.role_id
  WHERE r.name = 'parent'
    AND (raw_user_meta_data->>'role' IS NULL OR raw_user_meta_data->>'role' != 'parent')
);

-- Vérifier après mise à jour
SELECT
  u.email,
  au.raw_user_meta_data->>'role' AS role_in_metadata,
  r.name AS role_from_table,
  CASE
    WHEN au.raw_user_meta_data->>'role' = 'parent' THEN '✅ OK'
    ELSE '❌ PROBLÈME'
  END AS status
FROM users u
JOIN auth.users au ON au.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'parent'
ORDER BY u.email;
