-- =====================================================
-- Diagnostic: Vérifier le compte parent créé récemment
-- Remplacez l'EMAIL par celui du parent que vous avez créé
-- =====================================================

SET CLIENT_EMAIL = 'fadiala@gmail.com';  -- ← MODIFIER CETTE LIGNE

-- 1. Vérifier si l'utilisateur existe dans auth.users
SELECT '=== AUTH.USERS ===' AS section;
SELECT
  id::text AS auth_user_id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  raw_app_meta_data
FROM auth.users
WHERE email = :CLIENT_EMAIL;

-- 2. Vérifier l'utilisateur dans la table users
SELECT '=== USERS TABLE ===' AS section;
SELECT
  id::text AS user_id,
  email,
  first_name,
  last_name,
  school_id::text
FROM users
WHERE email = :CLIENT_EMAIL;

-- 3. Vérifier le parent record
SELECT '=== PARENTS TABLE ===' AS section;
SELECT
  id::text AS parent_id,
  user_id::text,
  email,
  first_name,
  last_name,
  relationship,
  phone,
  is_primary_contact,
  is_emergency_contact
FROM parents
WHERE email = :CLIENT_EMAIL;

-- 4. Vérifier le rôle
SELECT '=== USER ROLES ===' AS section;
SELECT
  ur.user_id::text,
  r.name AS role_name,
  ur.school_id::text
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
JOIN users u ON u.id = ur.user_id
WHERE u.email = :CLIENT_EMAIL;

-- 5. Vérifier la relation parent-élève
SELECT '=== STUDENT-PARENT RELATIONS ===' AS section;
SELECT
  id::text AS relation_id,
  parent_id::text,
  student_id::text,
  relationship,
  is_primary,
  can_pickup,
  can_view_grades,
  can_view_attendance,
  created_at
FROM student_parent_relations
WHERE parent_id = (
  SELECT id FROM parents WHERE email = :CLIENT_EMAIL
);

-- 6. Diagnostic complet
SELECT '=== DIAGNOSTIC COMPLET ===' AS section;
SELECT
  au.email,
  CASE
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Email confirmé'
    ELSE '❌ Email NON confirmé - BLOQUE LA CONNEXION'
  END AS email_status,
  CASE
    WHEN au.raw_user_meta_data->>'role' = 'parent' OR au.raw_app_meta_data->>'role' = 'parent' THEN '✅ Rôle OK'
    ELSE '❌ Rôle manquant dans metadata'
  END AS metadata_role,
  CASE
    WHEN p.id IS NOT NULL THEN '✅ Parent record existe'
    ELSE '❌ Parent record manquant'
  END AS parent_status,
  CASE
    WHEN ur.id IS NOT NULL THEN '✅ Rôle assigné dans user_roles'
    ELSE '❌ Rôle non assigné'
  END AS role_status,
  CASE
    WHEN spr.id IS NOT NULL THEN '✅ Relation parent-élève existe'
    ELSE '❌ Aucune relation parent-élève'
  END AS relation_status
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
LEFT JOIN parents p ON p.user_id = au.id
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN roles r ON r.id = ur.role_id
LEFT JOIN student_parent_relations spr ON spr.parent_id = p.id
WHERE au.email = :CLIENT_EMAIL;
