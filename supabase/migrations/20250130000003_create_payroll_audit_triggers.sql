-- Migration: Create Audit Triggers for Payroll Tables
-- Created: 2025-01-30
-- Description: Creates audit log triggers for all payroll tables to track changes

-- Audit triggers pour toutes les tables de paie
CREATE TRIGGER payroll_periods_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_periods
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER payroll_entries_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER salary_components_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON salary_components
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER payroll_payments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_payments
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER payroll_slips_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payroll_slips
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
