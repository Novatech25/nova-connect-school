-- Fix grades audit triggers to match the new audit_logs schema using log_audit_event
-- This replaces the old resource_type/resource_id logic

-- 1. Function: log_grade_audit_event
CREATE OR REPLACE FUNCTION log_grade_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action_value TEXT;
  description_value TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_value := 'create';
    description_value := 'Created grade for student_id: ' || NEW.student_id;
    PERFORM log_audit_event('grade', NEW.id, action_value, 'grades', description_value, NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    action_value := 'update';
    
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      description_value := 'Grade status changed: ' || OLD.status || ' → ' || NEW.status;
    ELSIF OLD.is_locked = false AND NEW.is_locked = true THEN
      description_value := 'Grade locked';
    ELSIF OLD.is_locked = true AND NEW.is_locked = false THEN
      description_value := 'Grade unlocked';
    ELSIF OLD.score IS DISTINCT FROM NEW.score THEN
      description_value := 'Grade score modified: ' || OLD.score || ' → ' || NEW.score;
    ELSE
      description_value := 'Grade updated';
    END IF;

    PERFORM log_audit_event('grade', NEW.id, action_value, 'grades', description_value, NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    action_value := 'delete';
    description_value := 'Deleted grade';
    PERFORM log_audit_event('grade', OLD.id, action_value, 'grades', description_value, OLD.school_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function: log_grade_submission_audit_event
CREATE OR REPLACE FUNCTION log_grade_submission_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action_value TEXT;
  description_value TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_value := 'create';
    description_value := 'Created grade submission with ' || NEW.total_grades || ' grades';
    PERFORM log_audit_event('grade_submission', NEW.id, action_value, 'grade_submissions', description_value, NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    action_value := 'update';
    
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      description_value := 'Grade submission status changed: ' || OLD.status || ' → ' || NEW.status;
    ELSE
      description_value := 'Grade submission updated';
    END IF;

    PERFORM log_audit_event('grade_submission', NEW.id, action_value, 'grade_submissions', description_value, NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    action_value := 'delete';
    description_value := 'Deleted grade submission';
    PERFORM log_audit_event('grade_submission', OLD.id, action_value, 'grade_submissions', description_value, OLD.school_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function: log_grade_workflow_transition
CREATE OR REPLACE FUNCTION log_grade_workflow_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM log_audit_event(
      'grade', 
      NEW.id, 
      'workflow_transition', 
      'grades', 
      'Grade workflow transitioned from ' || OLD.status || ' to ' || NEW.status, 
      NEW.school_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
