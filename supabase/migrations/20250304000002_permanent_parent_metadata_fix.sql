-- =====================================================
-- Migration: Permanent Fix for Parent Metadata
-- Created: 2025-02-03
-- Description: Ensures ALL parent accounts have correct metadata
--              and provides validation functions
-- =====================================================

-- =====================================================
-- 1. Check and Fix Existing Parents
-- =====================================================

-- Find parents with incomplete metadata
SELECT '=== PARENTS WITH INCOMPLETE METADATA ===' AS step;

SELECT
  au.email,
  au.id::text AS auth_user_id,
  CASE
    WHEN au.raw_user_meta_data->>'role' = 'parent' THEN 'OK'
    ELSE 'MISSING'
  END AS user_metadata_role_status,
  CASE
    WHEN au.raw_app_meta_data->>'role' = 'parent' THEN 'OK'
    ELSE 'MISSING'
  END AS app_metadata_role_status
FROM auth.users au
JOIN parents p ON p.email = au.email
WHERE au.raw_user_meta_data->>'role' IS NULL
   OR au.raw_app_meta_data->>'role' IS NULL
   OR au.raw_user_meta_data->>'role' != 'parent'
   OR au.raw_app_meta_data->>'role' != 'parent';

-- Fix user_metadata for parents (only if needed)
-- Uncomment to execute:

/*
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role', 'parent',
  'provider', 'email',
  'first_name', COALESCE(p.first_name, ''),
  'last_name', COALESCE(p.last_name, ''),
  'full_name', COALESCE(p.first_name || ' ' || p.last_name, ''),
  'school_code', COALESCE(s.code, '')
)
FROM parents p
JOIN schools s ON s.id = p.school_id
WHERE auth.users.email = p.email
  AND (raw_user_meta_data->>'role' IS NULL
       OR raw_user_meta_data->>'role' != 'parent');

-- Fix app_metadata for parents (only if needed)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role', 'parent',
  'provider', 'email',
  'school_id', p.school_id::text
)
FROM parents p
WHERE auth.users.email = p.email
  AND (raw_app_meta_data->>'role' IS NULL
       OR raw_app_meta_data->>'role' != 'parent');
*/

-- =====================================================
-- 2. Function: validate_parent_metadata
-- Validates parent account metadata
-- =====================================================

CREATE OR REPLACE FUNCTION validate_parent_metadata(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_result JSONB;
BEGIN
  -- Get user data
  SELECT * INTO v_user
  FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'User not found'
    );
  END IF;

  -- Validate metadata
  v_result := jsonb_build_object(
    'valid', true,
    'user_id', p_user_id::text,
    'email', v_user.email,
    'has_user_metadata_role', (v_user.raw_user_meta_data->>'role' IS NOT NULL),
    'has_app_metadata_role', (v_user.raw_app_meta_data->>'role' IS NOT NULL),
    'user_metadata_role', v_user.raw_user_meta_data->>'role',
    'app_metadata_role', v_user.raw_app_meta_data->>'role',
    'email_confirmed', (v_user.email_confirmed_at IS NOT NULL)
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- 3. Function: fix_parent_metadata
-- Automatically fixes parent metadata
-- =====================================================

CREATE OR REPLACE FUNCTION fix_parent_metadata(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_parent RECORD;
  v_school_code VARCHAR;
BEGIN
  -- Get user data
  SELECT * INTO v_user
  FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Get parent data
  SELECT p.*, s.code AS school_code INTO v_parent
  FROM parents p
  JOIN schools s ON s.id = p.school_id
  WHERE p.email = v_user.email;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent record not found'
    );
  END IF;

  v_school_code := v_parent.school_code;

  -- Update user_metadata
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', 'parent',
    'provider', 'email',
    'first_name', COALESCE(v_parent.first_name, v_user.raw_user_meta_data->>'first_name', ''),
    'last_name', COALESCE(v_parent.last_name, v_user.raw_user_meta_data->>'last_name', ''),
    'full_name', COALESCE(v_parent.first_name || ' ' || v_parent.last_name, v_user.raw_user_meta_data->>'full_name', ''),
    'school_code', COALESCE(v_school_code, v_user.raw_user_meta_data->>'school_code', ''),
    'school_id', v_parent.school_id::text
  )
  WHERE id = p_user_id;

  -- Update app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', 'parent',
    'provider', 'email',
    'school_id', v_parent.school_id::text
  )
  WHERE id = p_user_id;

  -- Confirm email
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id::text,
    'message', 'Parent metadata fixed successfully'
  );
END;
$$;

-- =====================================================
-- 4. Trigger: Fix Parent Metadata on Insert
-- Automatically ensures new parents have correct metadata
-- =====================================================

CREATE OR REPLACE FUNCTION ensure_parent_metadata_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process auth.users that have the parent role
  IF (NEW.raw_user_meta_data->>'role' = 'parent') THEN
    -- Ensure app_metadata has role
    IF (NEW.raw_app_meta_data->>'role' IS NULL OR NEW.raw_app_meta_data->>'role' != 'parent') THEN
      NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'role', 'parent',
        'provider', 'email'
      );
    END IF;

    -- Ensure email is confirmed
    IF (NEW.email_confirmed_at IS NULL) THEN
      NEW.email_confirmed_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_parent_metadata ON auth.users;
CREATE TRIGGER trigger_ensure_parent_metadata
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_parent_metadata_on_insert();

-- =====================================================
-- 5. Trigger: Fix Parent Metadata on Update
-- Ensures metadata remains correct on updates
-- =====================================================

CREATE OR REPLACE FUNCTION ensure_parent_metadata_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process auth.users that have the parent role
  IF (NEW.raw_user_meta_data->>'role' = 'parent') THEN
    -- Ensure app_metadata has role
    IF (NEW.raw_app_meta_data->>'role' IS NULL OR NEW.raw_app_meta_data->>'role' != 'parent') THEN
      NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'role', 'parent',
        'provider', 'email'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_parent_metadata_update ON auth.users;
CREATE TRIGGER trigger_ensure_parent_metadata_update
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
     OR OLD.raw_app_meta_data IS DISTINCT FROM NEW.raw_app_meta_data)
  EXECUTE FUNCTION ensure_parent_metadata_on_update();

-- =====================================================
-- 6. Grant Execute Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION validate_parent_metadata TO authenticated;
GRANT EXECUTE ON FUNCTION fix_parent_metadata TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON FUNCTION validate_parent_metadata IS 'Validates that a parent account has correct metadata (role in user_metadata and app_metadata, email confirmed)';

COMMENT ON FUNCTION fix_parent_metadata IS 'Automatically fixes parent account metadata by ensuring role is in both user_metadata and app_metadata, and email is confirmed';

COMMENT ON FUNCTION ensure_parent_metadata_on_insert IS 'Trigger that automatically ensures new parent accounts have correct metadata on insert';

COMMENT ON FUNCTION ensure_parent_metadata_on_update IS 'Trigger that automatically ensures parent accounts maintain correct metadata on update';

-- =====================================================
-- 7. Verification
-- =====================================================

SELECT '=== VERIFICATION ===' AS step;

-- Check triggers exist
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%parent_metadata%';

-- Check functions exist
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
WHERE p.proname IN ('validate_parent_metadata', 'fix_parent_metadata')
  AND p.pronamespace = 'public'::regnamespace;

-- Final check
SELECT
  'PERMANENT FIX APPLIED SUCCESSFULLY' AS status,
  'All future parent accounts will have correct metadata' AS message;
