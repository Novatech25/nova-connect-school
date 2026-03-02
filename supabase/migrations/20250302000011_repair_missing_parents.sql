-- =====================================================
-- Réparer les parents manquants dans la table parents
-- Pour les utilisateurs qui ont le rôle 'parent' mais pas d'enregistrement parents
-- =====================================================

-- Vérifier les parents manquants
SELECT '=== PARENTS MANQUANTS À RÉPARER ===' AS section;

SELECT
  u.id::text AS user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.school_id::text,
  au.raw_user_meta_data
FROM users u
JOIN auth.users au ON au.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'parent'
  AND NOT EXISTS (
    SELECT 1 FROM parents p WHERE p.email = u.email
  );

-- Créer les enregistrements parents manquants
INSERT INTO parents (
  id,
  school_id,
  user_id,
  email,
  first_name,
  last_name,
  phone,
  relationship,
  is_primary_contact,
  is_emergency_contact,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.school_id,
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  '0000000',  -- Valeur par défaut pour le téléphone
  'Parent',
  true,
  true,
  NOW(),
  NOW()
FROM users u
JOIN auth.users au ON au.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'parent'
  AND NOT EXISTS (
    SELECT 1 FROM parents p WHERE p.email = u.email
  );

-- Vérifier après réparation
SELECT '=== VÉRIFICATION APRÈS RÉPARATION ===' AS section;

SELECT
  u.email,
  CASE
    WHEN p.id IS NOT NULL THEN '✅ Parent existe'
    ELSE '❌ Parent manquant'
  END AS parent_status,
  CASE
    WHEN ur.id IS NOT NULL THEN '✅ Rôle assigné'
    ELSE '❌ Rôle manquant'
  END AS role_status
FROM users u
JOIN auth.users au ON au.id = u.id
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN parents p ON p.email = u.email
WHERE r.name = 'parent'
ORDER BY u.email;
