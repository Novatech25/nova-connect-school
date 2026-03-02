-- Broaden admin grade policies to accept school_id from users table or user_roles

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grades'
      AND policyname = 'grades_insert_policy_school_admin'
  ) THEN
    DROP POLICY grades_insert_policy_school_admin ON grades;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grades'
      AND policyname = 'grades_select_policy_school_admin'
  ) THEN
    DROP POLICY grades_select_policy_school_admin ON grades;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grades'
      AND policyname = 'grades_update_policy_school_admin'
  ) THEN
    DROP POLICY grades_update_policy_school_admin ON grades;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'grades'
      AND policyname = 'grades_delete_policy_school_admin'
  ) THEN
    DROP POLICY grades_delete_policy_school_admin ON grades;
  END IF;

  CREATE POLICY grades_insert_policy_school_admin
    ON grades
    FOR INSERT
    TO authenticated
    WITH CHECK (
      (is_school_admin() OR is_super_admin())
      AND (
        school_id = get_current_user_school_id()
        OR school_id IN (
          SELECT ur.school_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.name IN ('school_admin', 'super_admin')
        )
      )
    );

  CREATE POLICY grades_select_policy_school_admin
    ON grades
    FOR SELECT
    TO authenticated
    USING (
      (is_school_admin() OR is_super_admin())
      AND (
        school_id = get_current_user_school_id()
        OR school_id IN (
          SELECT ur.school_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.name IN ('school_admin', 'super_admin')
        )
      )
    );

  CREATE POLICY grades_update_policy_school_admin
    ON grades
    FOR UPDATE
    TO authenticated
    USING (
      (is_school_admin() OR is_super_admin())
      AND (
        school_id = get_current_user_school_id()
        OR school_id IN (
          SELECT ur.school_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.name IN ('school_admin', 'super_admin')
        )
      )
    )
    WITH CHECK (
      (is_school_admin() OR is_super_admin())
      AND (
        school_id = get_current_user_school_id()
        OR school_id IN (
          SELECT ur.school_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.name IN ('school_admin', 'super_admin')
        )
      )
    );

  CREATE POLICY grades_delete_policy_school_admin
    ON grades
    FOR DELETE
    TO authenticated
    USING (
      (is_school_admin() OR is_super_admin())
      AND (
        school_id = get_current_user_school_id()
        OR school_id IN (
          SELECT ur.school_id
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.name IN ('school_admin', 'super_admin')
        )
      )
    );
END $$;
