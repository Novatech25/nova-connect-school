-- Migration: Create Audit Triggers for Exam Module
-- Created: 2025-01-27
-- Description: Creates audit triggers for critical exam module operations

-- Audit triggers pour les actions critiques
CREATE TRIGGER audit_exam_sessions_changes
  AFTER INSERT OR UPDATE OR DELETE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_exam_deliberations_changes
  AFTER INSERT OR UPDATE OR DELETE ON exam_deliberations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_exam_results_changes
  AFTER INSERT OR UPDATE OR DELETE ON exam_results
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_exam_minutes_changes
  AFTER INSERT OR UPDATE OR DELETE ON exam_minutes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_exam_grades_changes
  AFTER INSERT OR UPDATE OR DELETE ON exam_grades
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
