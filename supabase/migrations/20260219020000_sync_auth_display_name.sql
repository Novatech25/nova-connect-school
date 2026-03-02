-- Migration to sync display_name from auth.users to public.users
-- This allows the frontend to access the user's name via public.users table

DO $$
DECLARE
    r RECORD;
    d_name TEXT;
BEGIN
    -- Iterate over all users in auth.users
    FOR r IN SELECT id, raw_user_meta_data FROM auth.users LOOP
        -- Prioritize display_name, displayName, full_name, etc.
        d_name := COALESCE(
            r.raw_user_meta_data->>'display_name', 
            r.raw_user_meta_data->>'displayName', 
            r.raw_user_meta_data->>'Display Name',
            r.raw_user_meta_data->>'full_name', 
            r.raw_user_meta_data->>'fullName'
        );
        
        -- If a display name is found
        IF d_name IS NOT NULL AND d_name != '' THEN
            -- Update public.users first_name with the full display name
            -- We set last_name to empty string to avoid duplication if it was generic
            
            -- Ideally we would split the name, but for display purposes putting it all in first_name works for now
            -- (or we could split on first space: split_part(d_name, ' ', 1) ...)
            
            UPDATE public.users pu
            SET 
                first_name = d_name,
                last_name = '' 
            WHERE pu.id = r.id;
            
            -- Note: We update unconditionally to fix existing bad data.
            -- You might want to remove the WHERE clause or add conditions like:
            -- AND (pu.first_name = 'Prenom' OR pu.first_name = '' OR pu.first_name IS NULL)
        END IF;
    END LOOP;
END $$;
