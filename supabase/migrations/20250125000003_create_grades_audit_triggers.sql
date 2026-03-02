-- ============================================
-- Migration: Audit Triggers for Grades
-- Created: 2025-01-25
-- Description: Creates audit triggers for comprehensive logging of grade actions
-- ============================================

-- ============================================
-- Ensure audit_logs table exists
-- ============================================

-- Note: The audit_logs table should already exist in the main schema
-- This migration only creates the triggers for the grades tables

-- ============================================
-- Function to log audit events for grades
-- ============================================

CREATE OR REPLACE FUNCTION log_grade_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action TEXT;
  details JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action := 'grade_created';
    details := jsonb_build_object(
      'grade_id', NEW.id,
      'student_id', NEW.student_id,
      'subject_id', NEW.subject_id,
      'class_id', NEW.class_id,
      'grade_type', NEW.grade_type,
      'title', NEW.title,
      'score', NEW.score,
      'max_score', NEW.max_score,
      'coefficient', NEW.coefficient,
      'status', NEW.status
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine specific action based on status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'submitted' THEN
        action := 'grade_submitted';
      ELSIF NEW.status = 'approved' THEN
        action := 'grade_approved';
      ELSIF NEW.status = 'published' THEN
        action := 'grade_published';
      ELSIF NEW.status = 'rejected' THEN
        action := 'grade_rejected';
      ELSE
        action := 'grade_status_changed';
      END IF;
    ELSIF OLD.is_locked = false AND NEW.is_locked = true THEN
      action := 'grade_locked';
    ELSIF OLD.is_locked = true AND NEW.is_locked = false THEN
      action := 'grade_unlocked';
    ELSIF OLD.score IS DISTINCT FROM NEW.score THEN
      action := 'grade_score_modified';
    ELSE
      action := 'grade_updated';
    END IF;

    details := jsonb_build_object(
      'grade_id', NEW.id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_score', OLD.score,
      'new_score', NEW.score,
      'old_locked', OLD.is_locked,
      'new_locked', NEW.is_locked,
      'changes', jsonb_build_object(
        'score', CASE WHEN OLD.score IS DISTINCT FROM NEW.score THEN jsonb_build_object('old', OLD.score, 'new', NEW.score) ELSE NULL END,
        'status', CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN jsonb_build_object('old', OLD.status, 'new', NEW.status) ELSE NULL END,
        'locked', CASE WHEN OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN jsonb_build_object('old', OLD.is_locked, 'new', NEW.is_locked) ELSE NULL END
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    action := 'grade_deleted';
    details := jsonb_build_object(
      'grade_id', OLD.id,
      'student_id', OLD.student_id,
      'subject_id', OLD.subject_id,
      'title', OLD.title,
      'score', OLD.score,
      'status', OLD.status
    );
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    auth.uid(),
    action,
    'grade',
    COALESCE(NEW.id, OLD.id),
    details,
    NULL, -- IP address would be set by the application
    NULL, -- User agent would be set by the application
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to log audit events for grade submissions
-- ============================================

CREATE OR REPLACE FUNCTION log_grade_submission_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action TEXT;
  details JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action := 'grade_submission_created';
    details := jsonb_build_object(
      'submission_id', NEW.id,
      'teacher_id', NEW.teacher_id,
      'class_id', NEW.class_id,
      'subject_id', NEW.subject_id,
      'period_id', NEW.period_id,
      'status', NEW.status,
      'total_grades', NEW.total_grades,
      'grades_entered', NEW.grades_entered
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine specific action based on status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'submitted' THEN
        action := 'grade_submission_submitted';
      ELSIF NEW.status = 'approved' THEN
        action := 'grade_submission_approved';
      ELSIF NEW.status = 'rejected' THEN
        action := 'grade_submission_rejected';
      ELSE
        action := 'grade_submission_status_changed';
      END IF;
    ELSE
      action := 'grade_submission_updated';
    END IF;

    details := jsonb_build_object(
      'submission_id', NEW.id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_grades_entered', OLD.grades_entered,
      'new_grades_entered', NEW.grades_entered,
      'old_completion', OLD.completion_percentage,
      'new_completion', NEW.completion_percentage,
      'rejection_reason', NEW.rejection_reason
    );
  ELSIF TG_OP = 'DELETE' THEN
    action := 'grade_submission_deleted';
    details := jsonb_build_object(
      'submission_id', OLD.id,
      'teacher_id', OLD.teacher_id,
      'class_id', OLD.class_id,
      'subject_id', OLD.subject_id,
      'status', OLD.status
    );
  END IF;

  -- Insert audit log
  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    auth.uid(),
    action,
    'grade_submission',
    COALESCE(NEW.id, OLD.id),
    details,
    NULL,
    NULL,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create triggers for audit logging
-- ============================================

-- Audit trigger for grades table
CREATE TRIGGER audit_grades_changes
  AFTER INSERT OR UPDATE OR DELETE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION log_grade_audit_event();

-- Audit trigger for grade_submissions table
CREATE TRIGGER audit_grade_submissions_changes
  AFTER INSERT OR UPDATE OR DELETE ON grade_submissions
  FOR EACH ROW
  EXECUTE FUNCTION log_grade_submission_audit_event();

-- ============================================
-- Additional audit function for grade workflow transitions
-- ============================================

CREATE OR REPLACE FUNCTION log_grade_workflow_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Log workflow transitions with detailed context
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      entity_type,
      entity_id,
      details,
      created_at
    )
    VALUES (
      NEW.school_id,
      auth.uid(),
      'grade_workflow_transition',
      'grade',
      NEW.id,
      jsonb_build_object(
        'transition', jsonb_build_object(
          'from', OLD.status,
          'to', NEW.status
        ),
        'student_id', NEW.student_id,
        'subject_id', NEW.subject_id,
        'grade_type', NEW.grade_type,
        'score', NEW.score,
        'approved_by', NEW.approved_by,
        'published_at', NEW.published_at
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Additional workflow audit trigger
CREATE TRIGGER audit_grade_workflow_transitions
  AFTER UPDATE ON grades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_grade_workflow_transition();

-- ============================================
-- Indexes for audit queries
-- ============================================

-- Create indexes for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type_id
  ON audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id
  ON audit_logs(school_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON FUNCTION log_grade_audit_event() IS '
Logs all grade-related actions including:
- Creation, modification, deletion
- Score changes
- Status transitions (draft -> submitted -> approved -> published)
- Lock/unlock actions
- Rejections with reasons
';

COMMENT ON FUNCTION log_grade_submission_audit_event() IS '
Logs all grade submission actions including:
- Submission creation
- Bulk grade entry
- Submission approval/rejection
- Completion percentage updates
';

COMMENT ON FUNCTION log_grade_workflow_transition() IS '
Logs detailed workflow state transitions for grades with full context';
