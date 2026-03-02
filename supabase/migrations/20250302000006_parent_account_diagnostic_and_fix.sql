-- =====================================================
-- Parent Account Diagnostic and Fix Script
-- Run this script in Supabase SQL Editor to:
-- 1. Diagnose parent account issues
-- 2. Create missing links between auth.users, users, and parents
-- 3. Create parent-student relations
-- 4. Assign proper roles
-- =====================================================

-- =====================================================
-- STEP 1: DIAGNOSTIC - Parent Account Check
-- =====================================================

-- Check all components for a specific parent email
DO $$
DECLARE
  v_parent_email VARCHAR := 'souleymane@gmail.com';  -- MODIFY THIS EMAIL
  v_user_id UUID;
  v_users_record_id UUID;
  v_parent_id UUID;
  v_role_id UUID;
  v_student_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'PARENT ACCOUNT DIAGNOSTIC FOR: %', v_parent_email;
  RAISE NOTICE '=====================================================';

  -- 1. Check auth.users (Supabase Auth)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_parent_email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE '✅ 1. Auth User found in auth.users (ID: %)', v_user_id;
  ELSE
    RAISE NOTICE '❌ 1. NO Auth User found in auth.users';
    RAISE NOTICE '   → User must be created via Supabase Dashboard (Authentication → Users → Add user)';
  END IF;

  -- 2. Check users table (public schema)
  SELECT id INTO v_users_record_id
  FROM users
  WHERE email = v_parent_email
  LIMIT 1;

  IF v_users_record_id IS NOT NULL THEN
    RAISE NOTICE '✅ 2. Users record found (ID: %)', v_users_record_id;
    IF v_user_id IS NOT NULL AND v_users_record_id != v_user_id THEN
      RAISE NOTICE '   ⚠️  WARNING: users.id (%) does not match auth.users.id (%)', v_users_record_id, v_user_id;
    END IF;
  ELSE
    RAISE NOTICE '❌ 2. NO Users record found';
  END IF;

  -- 3. Check parents table
  SELECT id INTO v_parent_id
  FROM parents
  WHERE email = v_parent_email
  LIMIT 1;

  IF v_parent_id IS NOT NULL THEN
    RAISE NOTICE '✅ 3. Parent record found (ID: %)', v_parent_id;
  ELSE
    RAISE NOTICE '❌ 3. NO Parent record found';
  END IF;

  -- 4. Check parent-student relations
  SELECT COUNT(*) INTO v_student_count
  FROM student_parent_relations spr
  JOIN parents p ON p.id = spr.parent_id
  WHERE p.email = v_parent_email;

  IF v_student_count > 0 THEN
    RAISE NOTICE '✅ 4. Parent-student relations found: % relation(s)', v_student_count;
  ELSE
    RAISE NOTICE '❌ 4. NO parent-student relations found';
  END IF;

  -- 5. Check user roles
  IF EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.email = v_parent_email AND r.name = 'parent'
  ) THEN
    RAISE NOTICE '✅ 5. User has ''parent'' role assigned';
  ELSE
    RAISE NOTICE '❌ 5. User does NOT have ''parent'' role';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';

  -- Summary
  IF v_user_id IS NOT NULL AND v_users_record_id IS NOT NULL AND v_parent_id IS NOT NULL AND v_student_count > 0 THEN
    RAISE NOTICE '🎉 STATUS: PARENT ACCOUNT IS COMPLETE!';
    RAISE NOTICE '   The parent should be able to log in and view their children.';
  ELSE
    RAISE NOTICE '⚠️  STATUS: PARENT ACCOUNT IS INCOMPLETE';
    RAISE NOTICE '   Run STEP 2 below to fix missing components.';
  END IF;

  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: FIX - Create Missing Links
-- =====================================================

-- This will automatically create missing links between all tables
DO $$
DECLARE
  v_parent_email VARCHAR := 'souleymane@gmail.com';  -- MODIFY THIS EMAIL
  v_student_name VARCHAR := 'Malick';                 -- MODIFY STUDENT NAME IF NEEDED
  v_relationship VARCHAR := 'Père';                   -- MODIFY RELATIONSHIP IF NEEDED

  v_user_id UUID;
  v_users_record_id UUID;
  v_parent_id UUID;
  v_school_id UUID;
  v_student_id UUID;
  v_role_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';

  -- 1. Get auth user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_parent_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ ERROR: No auth user found for %', v_parent_email;
    RAISE NOTICE '   Please create the user first in Supabase Dashboard:';
    RAISE NOTICE '   Authentication → Users → Add user → Create new user';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found auth user: %', v_user_id;

  -- 2. Get or create users record
  SELECT id, school_id INTO v_users_record_id, v_school_id
  FROM users
  WHERE id = v_user_id;  -- users.id should match auth.users.id

  IF v_users_record_id IS NULL THEN
    RAISE NOTICE '⚠️  No users record found, creating one...';

    -- Get metadata from auth.users
    INSERT INTO users (
      id,
      school_id,
      email,
      first_name,
      last_name,
      created_at,
      updated_at
    )
    SELECT
      v_user_id,
      '00000000-0000-0000-0000-000000000000',  -- Placeholder - UPDATE THIS!
      v_parent_email,
      COALESCE(raw_user_meta_data->>'firstName', 'Parent'),
      COALESCE(raw_user_meta_data->>'lastName', 'Account'),
      now(),
      now()
    FROM auth.users
    WHERE id = v_user_id
    RETURNING users.id, users.school_id INTO v_users_record_id, v_school_id;

    RAISE NOTICE '⚠️  Created users record but school_id is a placeholder!';
    RAISE NOTICE '   UPDATE: UPDATE users SET school_id = ''<your-school-id>'' WHERE id = ''%'';', v_user_id;
  ELSE
    RAISE NOTICE '✅ Found users record: %', v_users_record_id;
  END IF;

  IF v_school_id IS NULL OR v_school_id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION '❌ ERROR: School ID is not set for this user. Please update users.school_id first.';
  END IF;

  RAISE NOTICE '✅ School ID: %', v_school_id;

  -- 3. Get or create parent record
  SELECT id INTO v_parent_id
  FROM parents
  WHERE email = v_parent_email
  AND school_id = v_school_id
  LIMIT 1;

  IF v_parent_id IS NOT NULL THEN
    -- Update existing parent with user_id
    UPDATE parents
    SET user_id = v_user_id
    WHERE id = v_parent_id;
    RAISE NOTICE '✅ Updated parent record with user_id: %', v_parent_id;
  ELSE
    -- Create new parent record
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
      '0000000',
      v_relationship,
      TRUE,
      TRUE
    FROM users u
    WHERE u.id = v_user_id
    RETURNING parents.id INTO v_parent_id;

    RAISE NOTICE '✅ Created parent record: %', v_parent_id;
  END IF;

  -- 4. Get student ID
  SELECT id INTO v_student_id
  FROM students
  WHERE first_name ILIKE v_student_name
  AND school_id = v_school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE NOTICE '⚠️  Student "%" not found in school %', v_student_name, v_school_id;
    RAISE NOTICE '   Skipping parent-student relation creation.';
  ELSE
    RAISE NOTICE '✅ Found student: %', v_student_id;

    -- 5. Create parent-student relation if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM student_parent_relations
      WHERE parent_id = v_parent_id
      AND student_id = v_student_id
    ) THEN
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
        v_relationship,
        TRUE,
        TRUE,
        TRUE,
        TRUE
      );

      RAISE NOTICE '✅ Created parent-student relation';
    ELSE
      RAISE NOTICE '✅ Parent-student relation already exists';
    END IF;
  END IF;

  -- 6. Assign parent role
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = 'parent'
  LIMIT 1;

  IF v_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, school_id)
    VALUES (v_user_id, v_role_id, v_school_id)
    ON CONFLICT (user_id, role_id, school_id) DO NOTHING;

    RAISE NOTICE '✅ Assigned parent role to user';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '🎉 FIX COMPLETE! Parent account is now properly configured.';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- STEP 3: VERIFICATION - Display Complete Account Info
-- =====================================================

-- View complete account information
-- Auth User
SELECT
  'AUTH USER' AS component,
  id::text AS record_id,
  email AS field1,
  created_at::text AS field2
FROM auth.users
WHERE email = 'souleymane@gmail.com'  -- MODIFY THIS EMAIL

UNION ALL

-- Users Record
SELECT
  'USERS RECORD' AS component,
  id::text AS record_id,
  email AS field1,
  school_id::text AS field2
FROM users
WHERE email = 'souleymane@gmail.com'  -- MODIFY THIS EMAIL

UNION ALL

-- Parent Record
SELECT
  'PARENT RECORD' AS component,
  id::text AS record_id,
  email AS field1,
  COALESCE(user_id::text, 'NULL') AS field2
FROM parents
WHERE email = 'souleymane@gmail.com';  -- MODIFY THIS EMAIL

-- View all children linked to this parent
SELECT
  'CHILDREN' AS info,
  s.id::text AS student_id,
  s.first_name || ' ' || s.last_name AS child_name,
  s.matricule,
  spr.relationship,
  COALESCE(c.name, 'Non inscrit') AS class_name,
  COALESCE(ay.name, 'N/A') AS academic_year
FROM student_parent_relations spr
JOIN parents p ON p.id = spr.parent_id
JOIN students s ON s.id = spr.student_id
LEFT JOIN enrollments e ON e.student_id = s.id
LEFT JOIN classes c ON c.id = e.class_id
LEFT JOIN academic_years ay ON ay.id = e.academic_year_id
WHERE p.email = 'souleymane@gmail.com'  -- MODIFY THIS EMAIL
ORDER BY s.last_name, s.first_name;

-- View user roles
SELECT
  'USER ROLES' AS info,
  u.email,
  r.name AS role,
  s.name AS school
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN schools s ON s.id = ur.school_id
WHERE u.email = 'souleymane@gmail.com';  -- MODIFY THIS EMAIL

-- =====================================================
-- STEP 4: QUICK FIX FOR SPECIFIC PARENT-STUDENT PAIR
-- =====================================================

-- Use this for quick linking when you know both email and student name exist
-- Just modify the email and student_name variables below

DO $$
DECLARE
  v_parent_email VARCHAR := 'souleymane@gmail.com';  -- MODIFY
  v_student_name VARCHAR := 'Malick';                 -- MODIFY
  v_user_id UUID;
  v_parent_id UUID;
  v_school_id UUID;
  v_student_id UUID;
BEGIN
  -- Get user
  SELECT u.id INTO v_user_id
  FROM users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.email = v_parent_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', v_parent_email;
  END IF;

  -- Get school
  SELECT school_id INTO v_school_id FROM users WHERE id = v_user_id;

  -- Get or create parent
  SELECT id INTO v_parent_id
  FROM parents
  WHERE user_id = v_user_id OR email = v_parent_email
  LIMIT 1;

  IF v_parent_id IS NULL THEN
    INSERT INTO parents (school_id, user_id, first_name, last_name, email, relationship, is_primary_contact, is_emergency_contact)
    SELECT v_school_id, v_user_id, first_name, last_name, v_parent_email, 'Parent', TRUE, TRUE
    FROM users WHERE id = v_user_id
    RETURNING id INTO v_parent_id;
  END IF;

  -- Get student
  SELECT id INTO v_student_id
  FROM students
  WHERE first_name ILIKE v_student_name AND school_id = v_school_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student not found: % in school %', v_student_name, v_school_id;
  END IF;

  -- Create relation if not exists
  INSERT INTO student_parent_relations (school_id, parent_id, student_id, relationship, is_primary, can_pickup, can_view_grades, can_view_attendance)
  VALUES (v_school_id, v_parent_id, v_student_id, 'Père', TRUE, TRUE, TRUE, TRUE)
  ON CONFLICT DO NOTHING;

  -- Assign role
  INSERT INTO user_roles (user_id, role_id, school_id)
  SELECT v_user_id, id, v_school_id FROM roles WHERE name = 'parent'
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ Successfully linked % to %!', v_parent_email, v_student_name;
END $$;

-- =====================================================
-- END OF SCRIPT
-- =====================================================
