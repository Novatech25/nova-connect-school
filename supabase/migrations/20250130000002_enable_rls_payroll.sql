-- Migration: Enable RLS for Payroll Tables
-- Created: 2025-01-30
-- Description: Enables Row Level Security for all payroll tables with appropriate policies

-- Enable RLS
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_slips ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: payroll_periods
-- ============================================================================

CREATE POLICY "super_admin_all_payroll_periods" ON payroll_periods FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "school_admin_accountant_manage_payroll_periods" ON payroll_periods FOR ALL
  USING (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  )
  WITH CHECK (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  );

CREATE POLICY "teachers_read_own_payroll_periods" ON payroll_periods FOR SELECT
  USING (
    is_teacher()
    AND school_id = get_current_user_school_id()
    AND id IN (
      SELECT payroll_period_id FROM payroll_entries WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- POLICIES: payroll_entries
-- ============================================================================

CREATE POLICY "super_admin_all_payroll_entries" ON payroll_entries FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "school_admin_accountant_manage_payroll_entries" ON payroll_entries FOR ALL
  USING (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  )
  WITH CHECK (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  );

CREATE POLICY "teachers_read_own_payroll_entries" ON payroll_entries FOR SELECT
  USING (
    is_teacher()
    AND teacher_id = auth.uid()
    AND school_id = get_current_user_school_id()
  );

-- ============================================================================
-- POLICIES: salary_components
-- ============================================================================

CREATE POLICY "super_admin_all_salary_components" ON salary_components FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "school_admin_accountant_manage_salary_components" ON salary_components FOR ALL
  USING (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  )
  WITH CHECK (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  );

CREATE POLICY "teachers_read_own_salary_components" ON salary_components FOR SELECT
  USING (
    is_teacher()
    AND school_id = get_current_user_school_id()
    AND payroll_entry_id IN (
      SELECT id FROM payroll_entries WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- POLICIES: payroll_payments
-- ============================================================================

CREATE POLICY "super_admin_all_payroll_payments" ON payroll_payments FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "school_admin_accountant_manage_payroll_payments" ON payroll_payments FOR ALL
  USING (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  )
  WITH CHECK (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  );

CREATE POLICY "teachers_read_own_payroll_payments" ON payroll_payments FOR SELECT
  USING (
    is_teacher()
    AND school_id = get_current_user_school_id()
    AND payroll_entry_id IN (
      SELECT id FROM payroll_entries WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================================
-- POLICIES: payroll_slips
-- ============================================================================

CREATE POLICY "super_admin_all_payroll_slips" ON payroll_slips FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "school_admin_accountant_manage_payroll_slips" ON payroll_slips FOR ALL
  USING (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  )
  WITH CHECK (
    (is_school_admin() OR is_accountant())
    AND school_id = get_current_user_school_id()
  );

CREATE POLICY "teachers_read_own_payroll_slips" ON payroll_slips FOR SELECT
  USING (
    is_teacher()
    AND school_id = get_current_user_school_id()
    AND payroll_entry_id IN (
      SELECT id FROM payroll_entries WHERE teacher_id = auth.uid()
    )
  );
