-- =====================================================
-- Migration: Create Parent User Account Function
-- Created: 2025-03-02
-- Description: Creates an RPC function that creates both a user account in auth.users
--              and a parent record, then links them together
-- =====================================================

-- =====================================================
-- Function: create_parent_with_account
-- Creates a parent account with auth user and parent record
-- =====================================================

CREATE OR REPLACE FUNCTION create_parent_with_account(
  p_school_id UUID,
  p_first_name VARCHAR,
  p_last_name VARCHAR,
  p_email VARCHAR,
  p_phone VARCHAR,
  p_password TEXT,  -- Temporary password (will be required to change on first login)
  p_relationship VARCHAR DEFAULT 'Parent',
  p_address TEXT DEFAULT NULL,
  p_city VARCHAR DEFAULT NULL,
  p_occupation VARCHAR DEFAULT NULL,
  p_workplace VARCHAR DEFAULT NULL,
  p_is_primary_contact BOOLEAN DEFAULT FALSE,
  p_is_emergency_contact BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_parent_id UUID;
  v_role_id UUID;
BEGIN
  -- 1. Find the parent role
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = 'parent'
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent role not found in database'
    );
  END IF;

  -- 2. Create user account in auth.users
  -- Note: We need to use auth.uid() in a trigger or create via admin API
  -- This function assumes the user will be created separately
  -- and we receive the user_id, OR we create a pending account

  -- For now, let's create the parent record with a NULL user_id
  -- The admin will need to create the auth user via Supabase dashboard

  INSERT INTO parents (
    school_id,
    user_id,  -- Will be NULL until user account is created
    first_name,
    last_name,
    relationship,
    phone,
    email,
    address,
    city,
    occupation,
    workplace,
    is_primary_contact,
    is_emergency_contact
  ) VALUES (
    p_school_id,
    NULL,  -- user_id - to be linked later
    p_first_name,
    p_last_name,
    p_relationship,
    p_phone,
    p_email,
    p_address,
    p_city,
    p_occupation,
    p_workplace,
    p_is_primary_contact,
    p_is_emergency_contact
  )
  RETURNING parents.id INTO v_parent_id;

  RETURN jsonb_build_object(
    'success', true,
    'parent_id', v_parent_id,
    'message', 'Parent record created. Please create user account in Supabase Auth and link it.',
    'email', p_email
  );

EXCEPTION
  WHEN UNIQUE_VIOLATION THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent with this email already exists in this school'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- Function: link_parent_user
-- Links an existing auth user to a parent record
-- =====================================================

CREATE OR REPLACE FUNCTION link_parent_user(
  p_parent_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id UUID;
  v_user_school_id UUID;
BEGIN
  -- Get parent's school
  SELECT school_id INTO v_school_id
  FROM parents
  WHERE id = p_parent_id;

  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent not found'
    );
  END IF;

  -- Get user's school
  SELECT school_id INTO v_user_school_id
  FROM users
  WHERE id = p_user_id;

  IF v_user_school_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found or has no school'
    );
  END IF;

  -- Verify schools match
  IF v_school_id != v_user_school_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'School mismatch: parent and user belong to different schools'
    );
  END IF;

  -- Update parent with user_id
  UPDATE parents
  SET user_id = p_user_id
  WHERE id = p_parent_id;

  -- Assign parent role to user
  INSERT INTO user_roles (user_id, role_id, school_id)
  SELECT p_user_id, id, v_school_id
  FROM roles
  WHERE name = 'parent'
  ON CONFLICT (user_id, role_id, school_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'parent_id', p_parent_id,
    'user_id', p_user_id,
    'message', 'Parent account linked successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- Function: get_parent_or_create_pending
-- Gets a parent by email or creates a pending record
-- Useful for inviting parents
-- =====================================================

CREATE OR REPLACE FUNCTION get_parent_or_create_pending(
  p_school_id UUID,
  p_email VARCHAR,
  p_first_name VARCHAR DEFAULT NULL,
  p_last_name VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Check if parent exists
  SELECT id, TRUE INTO v_parent_id, v_exists
  FROM parents
  WHERE school_id = p_school_id
  AND email = p_email
  LIMIT 1;

  IF v_exists THEN
    RETURN jsonb_build_object(
      'success', true,
      'exists', true,
      'parent_id', v_parent_id,
      'message', 'Parent already exists'
    );
  END IF;

  -- Create pending parent record
  INSERT INTO parents (
    school_id,
    user_id,
    first_name,
    last_name,
    email,
    is_primary_contact,
    is_emergency_contact
  ) VALUES (
    p_school_id,
    NULL,  -- No user account yet
    COALESCE(p_first_name, 'Pending'),
    COALESCE(p_last_name, 'Account'),
    p_email,
    FALSE,
    FALSE
  )
  RETURNING parents.id INTO v_parent_id;

  RETURN jsonb_build_object(
    'success', true,
    'exists', false,
    'parent_id', v_parent_id,
    'message', 'Pending parent record created. User account needs to be created.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- Grant execute permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION create_parent_with_account TO authenticated;
GRANT EXECUTE ON FUNCTION link_parent_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_parent_or_create_pending TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON FUNCTION create_parent_with_account IS 'Creates a parent record. Note: Auth user must be created separately via Supabase Admin or dashboard, then linked using link_parent_user().';

COMMENT ON FUNCTION link_parent_user IS 'Links an existing auth user (from auth.users) to a parent record. Use this after creating the user account in Supabase Auth.';

COMMENT ON FUNCTION get_parent_or_create_pending IS 'Gets existing parent by email or creates a pending record. Useful for parent invitations.';
