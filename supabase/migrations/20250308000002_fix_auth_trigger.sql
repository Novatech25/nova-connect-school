CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
    new_user_id uuid := NEW.id;
    new_email text := NEW.email;
    
    -- Try to find a display name first
    display_name text := COALESCE(
        NEW.raw_user_meta_data->>'display_name', 
        NEW.raw_user_meta_data->>'displayName', 
        NEW.raw_user_meta_data->>'Display Name',
        NEW.raw_user_meta_data->>'full_name'
    );
    
    new_first_name text := COALESCE(display_name, NEW.raw_user_meta_data->>'first_name', 'Prenom');
    new_last_name text := CASE 
        WHEN display_name IS NOT NULL THEN '' 
        ELSE COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nom') 
    END;
    
    new_role_key text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
    new_school_code text := NEW.raw_user_meta_data->>'school_code';
    target_school_id uuid := NULL;
    target_role_id uuid;
    is_super_admin boolean := false;
BEGIN
    -- Verify super_admin role
    IF new_role_key = 'super_admin' THEN
        is_super_admin := true;
        target_school_id := NULL;
    ELSE
        IF new_school_code IS NULL OR new_school_code = '' THEN
            RAISE EXCEPTION 'School code is required for role %', new_role_key;
        END IF;

        SELECT id INTO target_school_id
        FROM schools
        WHERE code = new_school_code AND status = 'active';

        IF target_school_id IS NULL THEN
            RAISE EXCEPTION 'Invalid school code: %', new_school_code;
        END IF;
    END IF;

    SELECT id INTO target_role_id
    FROM roles
    WHERE name = new_role_key;

    IF target_role_id IS NULL THEN
        RAISE EXCEPTION 'Invalid role: %', new_role_key;
    END IF;

    INSERT INTO users (
        id,
        email,
        first_name,
        last_name,
        school_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        new_email,
        new_first_name,
        new_last_name,
        target_school_id,
        COALESCE((NEW.email_confirmed_at IS NOT NULL), false),
        NOW(),
        NOW()
    );

    INSERT INTO user_roles (
        user_id,
        role_id,
        assigned_by,
        assigned_at
    ) VALUES (
        new_user_id,
        target_role_id,
        new_user_id,
        NOW()
    );

    INSERT INTO audit_logs (
        user_id,
        school_id,
        action,
        resource_type,
        resource_id,
        old_data,
        new_data,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        new_user_id,
        target_school_id,
        'INSERT',
        'users',
        new_user_id,
        jsonb_build_object(),
        jsonb_build_object(
            'email', new_email,
            'first_name', new_first_name,
            'last_name', new_last_name,
            'role', new_role_key,
            'school_code', new_school_code,
            'school_id', target_school_id
        ),
        NULL,
        'Supabase Auth Trigger',
        NOW()
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user profile for auth user %: %', new_user_id, SQLERRM;

        INSERT INTO audit_logs (
            user_id,
            school_id,
            action,
            resource_type,
            resource_id,
            old_data,
            new_data,
            ip_address,
            user_agent,
            created_at
        ) VALUES (
            NULL,
            NULL,
            'INSERT',
            'auth.users',
            new_user_id,
            jsonb_build_object(),
            jsonb_build_object(
                'error', SQLERRM,
                'email', new_email,
                'role', new_role_key,
                'school_code', new_school_code
            ),
            NULL,
            'Supabase Auth Trigger',
            NOW()
        );

        RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

COMMENT ON FUNCTION handle_new_user() IS 'Creates user profile and assigns role after signup via Supabase Auth';
