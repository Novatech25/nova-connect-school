-- Make admin insert policy rely directly on user_roles membership

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
      school_id IN (
        SELECT ur.school_id
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('school_admin', 'super_admin')
      )
    );
END $$;
