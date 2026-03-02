-- Migration to allow school admins to update their own school information

-- Policy for school admins to update their own school
CREATE POLICY "school_admin_update_own_school"
ON schools FOR UPDATE
USING (
  is_school_admin()
  AND id = get_current_user_school_id()
)
WITH CHECK (
  is_school_admin()
  AND id = get_current_user_school_id()
);
