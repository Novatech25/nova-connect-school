-- Audit trigger for students
CREATE TRIGGER audit_students_changes
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for parents
CREATE TRIGGER audit_parents_changes
  AFTER INSERT OR UPDATE OR DELETE ON parents
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for student_parent_relations
CREATE TRIGGER audit_student_parent_relations_changes
  AFTER INSERT OR UPDATE OR DELETE ON student_parent_relations
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for enrollments
CREATE TRIGGER audit_enrollments_changes
  AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();

-- Audit trigger for student_documents
CREATE TRIGGER audit_student_documents_changes
  AFTER INSERT OR UPDATE OR DELETE ON student_documents
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();
