-- ============================================================================
-- Mobile Money RLS Policies
-- ============================================================================
-- Row Level Security policies for Mobile Money tables
-- Ensures multi-tenant isolation and proper access control
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE mobile_money_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_money_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policies for mobile_money_providers
-- ============================================================================

-- School admins can view providers for their school
CREATE POLICY "School admins can view providers"
ON mobile_money_providers FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- Accountants can view providers for their school
CREATE POLICY "Accountants can view providers"
ON mobile_money_providers FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- Only school admins can insert providers
CREATE POLICY "School admins can create providers"
ON mobile_money_providers FOR INSERT
TO authenticated
WITH CHECK (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- Only school admins can update providers
CREATE POLICY "School admins can update providers"
ON mobile_money_providers FOR UPDATE
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
)
WITH CHECK (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- Only school admins can delete providers
CREATE POLICY "School admins can delete providers"
ON mobile_money_providers FOR DELETE
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- ============================================================================
-- Policies for mobile_money_transactions
-- ============================================================================

-- School admins can view all transactions for their school
CREATE POLICY "School admins can view all transactions"
ON mobile_money_transactions FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() IN ('school_admin', 'supervisor')
);

-- Accountants can view all transactions for their school
CREATE POLICY "Accountants can view transactions"
ON mobile_money_transactions FOR SELECT
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- Parents can view transactions for their children
CREATE POLICY "Parents can view children transactions"
ON mobile_money_transactions FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT student_id
    FROM student_parent_relations
    WHERE parent_id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- Students can view their own transactions
CREATE POLICY "Students can view own transactions"
ON mobile_money_transactions FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
  AND get_user_role() = 'school_admin'
);

-- Authenticated users can insert transactions (via Edge Function)
CREATE POLICY "Authenticated users can create transactions"
ON mobile_money_transactions FOR INSERT
TO authenticated
WITH CHECK (
  -- Verify school_id matches user's school
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  -- Verify student belongs to the same school
  AND EXISTS (
    SELECT 1 FROM students
    WHERE id = student_id
    AND school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  )
);

-- School admins and accountants can update transactions
CREATE POLICY "School staff can update transactions"
ON mobile_money_transactions FOR UPDATE
TO authenticated
USING (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() IN ('school_admin', 'supervisor')
)
WITH CHECK (
  school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  )
  AND get_user_role() IN ('school_admin', 'supervisor')
);

-- No delete policy (soft delete via status)

-- ============================================================================
-- Service role bypass (for Edge Functions)
-- ============================================================================

-- Service role can do everything (needed for Edge Functions)
GRANT ALL ON mobile_money_providers TO service_role;
GRANT ALL ON mobile_money_transactions TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY "School admins can view providers" ON mobile_money_providers IS
'Allows school administrators to view Mobile Money providers configured for their school';

COMMENT ON POLICY "Accountants can view providers" ON mobile_money_providers IS
'Allows accountants to view Mobile Money provider information';

COMMENT ON POLICY "School admins can create providers" ON mobile_money_providers IS
'Only school administrators can create new Mobile Money provider configurations';

COMMENT ON POLICY "Parents can view children transactions" ON mobile_money_transactions IS
'Parents can only view Mobile Money transactions for their linked children';

COMMENT ON POLICY "Students can view own transactions" ON mobile_money_transactions IS
'Students can only view their own Mobile Money transactions';
