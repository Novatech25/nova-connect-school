-- Migration: Create audit triggers for report cards
-- Description: Adds audit logging for report_cards and report_card_versions tables

-- Audit trigger for report_cards
CREATE TRIGGER audit_report_cards_changes
  AFTER INSERT OR UPDATE OR DELETE ON report_cards
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for report_card_versions
CREATE TRIGGER audit_report_card_versions_changes
  AFTER INSERT OR UPDATE OR DELETE ON report_card_versions
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Add comments
COMMENT ON TRIGGER audit_report_cards_changes ON report_cards IS 'Logs all changes to report_cards in audit_log table';
COMMENT ON TRIGGER audit_report_card_versions_changes ON report_card_versions IS 'Logs all changes to report_card_versions in audit_log table';
