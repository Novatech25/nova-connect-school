-- Migration: Enable RLS for Payment Tables
-- Description: Enables Row Level Security and creates policies for all payment tables
-- Date: 2025-01-27

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_exemptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper Functions (assumed to exist in codebase)
-- ============================================

-- These functions should already exist in the NovaConnect system
-- get_user_school_id() - returns the school_id for the current user
-- get_user_role() - returns the role for the current user

-- ============================================
-- Policies: fee_types
-- ============================================

-- SELECT: All authenticated users can see fee types for their school
CREATE POLICY "fee_types_select_school_users"
  ON fee_types
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
  );

-- INSERT: Only school_admin and accountant can create fee types
CREATE POLICY "fee_types_insert_admin_accountant"
  ON fee_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- UPDATE: Only school_admin and accountant can update fee types
CREATE POLICY "fee_types_update_admin_accountant"
  ON fee_types
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- DELETE: Only school_admin and accountant can delete fee types
CREATE POLICY "fee_types_delete_admin_accountant"
  ON fee_types
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- ============================================
-- Policies: fee_schedules
-- ============================================

-- SELECT for school_admin and accountant: all fee schedules for their school
CREATE POLICY "fee_schedules_select_admin_accountant"
  ON fee_schedules
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- SELECT for students: only their own fee schedules
CREATE POLICY "fee_schedules_select_student"
  ON fee_schedules
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'student'
    AND student_id = auth.uid()
  );

-- SELECT for parents: fee schedules of their children
CREATE POLICY "fee_schedules_select_parent"
  ON fee_schedules
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'parent'
    AND student_id IN (
      SELECT student_id
      FROM student_parent_relations
      WHERE parent_id = auth.uid()
    )
  );

-- INSERT: Only school_admin and accountant
CREATE POLICY "fee_schedules_insert_admin_accountant"
  ON fee_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- UPDATE: Only school_admin and accountant
CREATE POLICY "fee_schedules_update_admin_accountant"
  ON fee_schedules
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- DELETE: Only school_admin
CREATE POLICY "fee_schedules_delete_admin"
  ON fee_schedules
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- ============================================
-- Policies: payments
-- ============================================

-- SELECT for school_admin and accountant: all payments for their school
CREATE POLICY "payments_select_admin_accountant"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- SELECT for students: only their own payments
CREATE POLICY "payments_select_student"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'student'
    AND student_id = auth.uid()
  );

-- SELECT for parents: payments of their children
CREATE POLICY "payments_select_parent"
  ON payments
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'parent'
    AND student_id IN (
      SELECT student_id
      FROM student_parent_relations
      WHERE parent_id = auth.uid()
    )
  );

-- INSERT: Only school_admin and accountant
CREATE POLICY "payments_insert_admin_accountant"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- UPDATE: Only school_admin (for error corrections)
CREATE POLICY "payments_update_admin"
  ON payments
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- DELETE: Only school_admin
CREATE POLICY "payments_delete_admin"
  ON payments
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- ============================================
-- Policies: payment_receipts
-- ============================================

-- SELECT for school_admin and accountant: all receipts
CREATE POLICY "payment_receipts_select_admin_accountant"
  ON payment_receipts
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- SELECT for students: their own receipts
CREATE POLICY "payment_receipts_select_student"
  ON payment_receipts
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'student'
    AND payment_id IN (
      SELECT id FROM payments WHERE student_id = auth.uid()
    )
  );

-- SELECT for parents: receipts of their children
CREATE POLICY "payment_receipts_select_parent"
  ON payment_receipts
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'parent'
    AND payment_id IN (
      SELECT p.id
      FROM payments p
      JOIN student_parent_relations spr ON p.student_id = spr.student_id
      WHERE spr.parent_id = auth.uid()
    )
  );

-- INSERT: Only school_admin and accountant (via Edge Function)
CREATE POLICY "payment_receipts_insert_admin_accountant"
  ON payment_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- UPDATE: No one (immutable after generation)
CREATE POLICY "payment_receipts_update_none"
  ON payment_receipts
  FOR UPDATE
  TO authenticated
  USING (false);

-- DELETE: No one (immutable after generation)
CREATE POLICY "payment_receipts_delete_none"
  ON payment_receipts
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================
-- Policies: payment_reminders
-- ============================================

-- SELECT: Only school_admin and accountant
CREATE POLICY "payment_reminders_select_admin_accountant"
  ON payment_reminders
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- INSERT: Only school_admin and accountant (via Edge Function)
CREATE POLICY "payment_reminders_insert_admin_accountant"
  ON payment_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- UPDATE: Only school_admin and accountant
CREATE POLICY "payment_reminders_update_admin_accountant"
  ON payment_reminders
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- DELETE: Only school_admin
CREATE POLICY "payment_reminders_delete_admin"
  ON payment_reminders
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- ============================================
-- Policies: payment_exemptions
-- ============================================

-- SELECT for school_admin and accountant: all exemptions
CREATE POLICY "payment_exemptions_select_admin_accountant"
  ON payment_exemptions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() IN ('school_admin', 'accountant')
  );

-- SELECT for students: their own exemptions
CREATE POLICY "payment_exemptions_select_student"
  ON payment_exemptions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'student'
    AND student_id = auth.uid()
  );

-- SELECT for parents: exemptions of their children
CREATE POLICY "payment_exemptions_select_parent"
  ON payment_exemptions
  FOR SELECT
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'parent'
    AND student_id IN (
      SELECT student_id
      FROM student_parent_relations
      WHERE parent_id = auth.uid()
    )
  );

-- INSERT: Only school_admin (validation required)
CREATE POLICY "payment_exemptions_insert_admin"
  ON payment_exemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
    AND approved_by = auth.uid()
  );

-- UPDATE: Only school_admin
CREATE POLICY "payment_exemptions_update_admin"
  ON payment_exemptions
  FOR UPDATE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  )
  WITH CHECK (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- DELETE: Only school_admin
CREATE POLICY "payment_exemptions_delete_admin"
  ON payment_exemptions
  FOR DELETE
  TO authenticated
  USING (
    school_id = get_user_school_id()
    AND get_user_role() = 'school_admin'
  );

-- Add helpful comments
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
-- Note: Policy comment removed for Supabase compatibility
