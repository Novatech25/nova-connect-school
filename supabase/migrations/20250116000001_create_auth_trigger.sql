-- Trigger Supabase pour synchroniser auth.users → users automatiquement
-- Ce trigger s'exécute après chaque nouvel inscrit et crée le profil utilisateur
-- avec les métadonnées du signup (first_name, last_name, role, school_code)

-- Fonction pour gérer la création d'un nouvel utilisateur
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_user_id uuid := NEW.id;
    new_email text := NEW.email;
    new_first_name text := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Prénom');
    new_last_name text := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nom');
    new_role_key text := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
    new_school_code text := NEW.raw_user_meta_data->>'school_code';
    target_school_id uuid := NULL;
    target_role_id int;
    is_super_admin boolean := false;
BEGIN
    -- Vérifier si le rôle est super_admin
    IF new_role_key = 'super_admin' THEN
        is_super_admin := true;
        target_school_id := NULL;
    ELSE
        -- Valider que le school_code est fourni pour les rôles non super_admin
        IF new_school_code IS NULL OR new_school_code = '' THEN
            RAISE EXCEPTION 'School code is required for role %', new_role_key;
        END IF;

        -- Rechercher le school_id via le school_code
        SELECT id INTO target_school_id
        FROM schools
        WHERE code = new_school_code AND status = 'active';

        -- Lever une erreur si le school_code n'existe pas
        IF target_school_id IS NULL THEN
            RAISE EXCEPTION 'Invalid school code: %', new_school_code;
        END IF;
    END IF;

    -- Récupérer le role_id correspondant à la clé du rôle
    SELECT id INTO target_role_id
    FROM roles
    WHERE name = new_role_key;

    -- Lever une erreur si le rôle n'existe pas
    IF target_role_id IS NULL THEN
        RAISE EXCEPTION 'Invalid role: %', new_role_key;
    END IF;

    -- Insérer l'utilisateur dans la table users
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
        COALESCE((NEW.email_confirmed_at IS NOT NULL), false), -- is_active: true si email confirmé
        NOW(),
        NOW()
    );

    -- Assigner le rôle à l'utilisateur via la table user_roles
    INSERT INTO user_roles (
        user_id,
        role_id,
        assigned_by,
        assigned_at
    ) VALUES (
        new_user_id,
        target_role_id,
        new_user_id, -- Auto-assigné lors de l'inscription
        NOW()
    );

    -- Créer un log d'audit pour tracer la création automatique du profil
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
        NULL, -- IP address non disponible côté serveur
        'Supabase Auth Trigger',
        NOW()
    );

    -- Retourner le nouvel utilisateur
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- En cas d'erreur, log l'erreur et propage l'exception
        RAISE WARNING 'Failed to create user profile for auth user %: %', new_user_id, SQLERRM;

        -- Insérer un log d'audit pour l'erreur
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

        -- Propager l'erreur
        RAISE;
END;
$$;

-- Créer le trigger qui appelle la fonction après chaque INSERT dans auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Commentaires de documentation
COMMENT ON FUNCTION handle_new_user() IS 'Crée automatiquement le profil utilisateur et assigne le rôle après l''inscription via Supabase Auth';
-- Note: Cannot comment on system trigger on auth.users in Supabase
