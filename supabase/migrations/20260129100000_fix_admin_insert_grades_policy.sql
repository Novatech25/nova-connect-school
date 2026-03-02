-- Ensure admin grade insert policy uses role membership checks

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grades'
      AND policyname = 'grades_insert_policy_school_admin'
  ) THEN
    DROP POLICY grades_insert_policy_school_admin ON grades;
  END IF;

  CREATE POLICY grades_insert_policy_school_admin
    ON grades
    FOR INSERT
    TO authenticated
    WITH CHECK (
      school_id = COALESCE(get_current_user_school_id(), get_user_school_id())
      AND (is_school_admin() OR is_super_admin())
    );
END $$;
