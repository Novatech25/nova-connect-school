-- Allow school_admin to insert grades (bulk entry from admin UI)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grades'
      AND policyname = 'grades_insert_policy_school_admin'
  ) THEN
    CREATE POLICY grades_insert_policy_school_admin
      ON grades
      FOR INSERT
      TO authenticated
      WITH CHECK (
        school_id = get_user_school_id()
        AND get_user_role() = 'school_admin'
      );
  END IF;
END $$;
