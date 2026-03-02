-- =====================================================
-- Diagnostic Simple - Vérifier toutes les données
-- =====================================================

-- 1. Vérifier tous les utilisateurs dans auth.users
SELECT '=== AUTH.USERS ===' AS info;
SELECT id, email, created_at, confirmed_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Vérifier tous les utilisateurs dans users table
SELECT '=== USERS TABLE ===' AS info;
SELECT id, email, first_name, last_name, school_id
FROM users
ORDER BY last_name, first_name;

-- 3. Vérifier tous les parents
SELECT '=== PARENTS TABLE ===' AS info;
SELECT id, email, first_name, last_name, user_id, school_id
FROM parents
ORDER BY last_name, first_name;

-- 4. Vérifier toutes les relations parent-étudiant
SELECT '=== PARENT-STUDENT RELATIONS ===' AS info;
SELECT
  spr.id,
  p.email AS parent_email,
  p.first_name || ' ' || p.last_name AS parent_name,
  s.first_name || ' ' || s.last_name AS student_name,
  s.matricule,
  spr.relationship
FROM student_parent_relations spr
JOIN parents p ON p.id = spr.parent_id
JOIN students s ON s.id = spr.student_id
ORDER BY p.last_name, s.last_name;

-- 5. Vérifier tous les rôles utilisateurs
SELECT '=== USER ROLES ===' AS info;
SELECT
  u.email,
  r.name AS role,
  s.name AS school
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN schools s ON s.id = ur.school_id
ORDER BY u.email, r.name;

-- 6. Chercher spécifiquement souleymane@gmail.com
SELECT '=== RECHERCHE SOULEYMANE ===' AS info;

-- Dans auth.users
SELECT
  'auth.users' AS table_name,
  id::text,
  email,
  'found' AS status
FROM auth.users
WHERE email ILIKE '%souleymane%'

UNION ALL

-- Dans users
SELECT
  'users' AS table_name,
  id::text,
  email,
  'found' AS status
FROM users
WHERE email ILIKE '%souleymane%'

UNION ALL

-- Dans parents
SELECT
  'parents' AS table_name,
  id::text,
  email,
  'found' AS status
FROM parents
WHERE email ILIKE '%souleymane%';

-- 7. Chercher l'étudiant Malick
SELECT '=== RECHERCHE ETUDIANT MALICK ===' AS info;
SELECT
  id,
  first_name,
  last_name,
  matricule,
  school_id,
  status
FROM students
WHERE first_name ILIKE '%Malick%'
ORDER BY last_name;
