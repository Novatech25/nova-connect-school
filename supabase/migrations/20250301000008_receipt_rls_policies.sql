-- Migration: RLS Policies for Enhanced Receipt System
-- Date: 2025-03-01
-- Description: Add Row Level Security policies for new receipt tables

ALTER TABLE receipt_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Policies receipt_sequences (admin/accountant seulement)
CREATE POLICY "receipt_sequences_select" ON receipt_sequences FOR SELECT
  USING ((is_school_admin() OR is_accountant()) AND school_id = get_current_user_school_id());

CREATE POLICY "receipt_sequences_insert" ON receipt_sequences FOR INSERT
  WITH CHECK ((is_school_admin() OR is_accountant()) AND school_id = get_current_user_school_id());

CREATE POLICY "receipt_sequences_update" ON receipt_sequences FOR UPDATE
  USING ((is_school_admin() OR is_accountant()) AND school_id = get_current_user_school_id());

-- Policies printer_profiles
CREATE POLICY "printer_profiles_all_admin" ON printer_profiles FOR ALL
  USING ((is_school_admin() OR is_accountant()) AND school_id = get_current_user_school_id());

CREATE POLICY "printer_profiles_select_all" ON printer_profiles FOR SELECT
  USING (school_id = get_current_user_school_id());

CREATE POLICY "printer_profiles_insert" ON printer_profiles FOR INSERT
  WITH CHECK ((is_school_admin() OR is_accountant()) AND school_id = get_current_user_school_id());

CREATE POLICY "printer_profiles_update" ON printer_profiles FOR UPDATE
  USING ((is_school_admin() OR is_accountant()) AND school_id = get_current_user_school_id());

CREATE POLICY "printer_profiles_delete" ON printer_profiles FOR DELETE
  USING ((is_school_admin() OR is_accountant()) AND school_id = get_current_user_school_id());

-- Policies verification_tokens (service role only - no client access)
-- Verification tokens are accessed only through the verify-receipt Edge Function using service role
CREATE POLICY "verification_tokens_insert_admin" ON receipt_verification_tokens FOR INSERT
  WITH CHECK (is_school_admin() OR is_accountant());

CREATE POLICY "verification_tokens_update_admin" ON receipt_verification_tokens FOR UPDATE
  USING (is_school_admin() OR is_accountant());

CREATE POLICY "verification_tokens_delete_admin" ON receipt_verification_tokens FOR DELETE
  USING (is_school_admin() OR is_accountant());
