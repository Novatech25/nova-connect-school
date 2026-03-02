-- ============================================
-- Migration: Fix Grades Audit Triggers Column Names
-- Created: 2026-02-16
-- Description: Fix column names in grades audit functions (entity_type -> resource_type, entity_id -> resource_id)
-- ============================================

-- ============================================
-- Fix function to log audit events for grades
-- ============================================

CREATE OR REPLACE FUNCTION log_grade_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_details JSONB;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'grade_created';
    v_new_data := to_jsonb(NEW);
    v_details := jsonb_build_object(
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
        v_action := 'grade_submitted';
      ELSIF NEW.status = 'approved' THEN
        v_action := 'grade_approved';
      ELSIF NEW.status = 'published' THEN
        v_action := 'grade_published';
      ELSIF NEW.status = 'rejected' THEN
        v_action := 'grade_rejected';
      ELSE
        v_action := 'grade_status_changed';
      END IF;
    ELSIF OLD.is_locked = false AND NEW.is_locked = true THEN
      v_action := 'grade_locked';
    ELSIF OLD.is_locked = true AND NEW.is_locked = false THEN
      v_action := 'grade_unlocked';
    ELSIF OLD.score IS DISTINCT FROM NEW.score THEN
      v_action := 'grade_score_modified';
    ELSE
      v_action := 'grade_updated';
    END IF;

    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_details := jsonb_build_object(
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
    v_action := 'grade_deleted';
    v_old_data := to_jsonb(OLD);
    v_details := jsonb_build_object(
      'grade_id', OLD.id,
      'student_id', OLD.student_id,
      'subject_id', OLD.subject_id,
      'title', OLD.title,
      'score', OLD.score,
      'status', OLD.status
    );
  END IF;

  -- Insert audit log with correct column names (resource_type, resource_id, old_data, new_data)
  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    metadata,
    created_at
  )
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    auth.uid(),
    v_action::audit_action_enum,
    'grade',
    COALESCE(NEW.id, OLD.id),
    v_old_data,
    v_new_data,
    v_details,
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
-- Fix function to log audit events for grade submissions
-- ============================================

CREATE OR REPLACE FUNCTION log_grade_submission_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_details JSONB;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'grade_submission_created';
    v_new_data := to_jsonb(NEW);
    v_details := jsonb_build_object(
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
        v_action := 'grade_submission_submitted';
      ELSIF NEW.status = 'approved' THEN
        v_action := 'grade_submission_approved';
      ELSIF NEW.status = 'rejected' THEN
        v_action := 'grade_submission_rejected';
      ELSE
        v_action := 'grade_submission_status_changed';
      END IF;
    ELSE
      v_action := 'grade_submission_updated';
    END IF;

    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_details := jsonb_build_object(
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
    v_action := 'grade_submission_deleted';
    v_old_data := to_jsonb(OLD);
    v_details := jsonb_build_object(
      'submission_id', OLD.id,
      'teacher_id', OLD.teacher_id,
      'class_id', OLD.class_id,
      'subject_id', OLD.subject_id,
      'status', OLD.status
    );
  END IF;

  -- Insert audit log with correct column names (resource_type, resource_id, old_data, new_data)
  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    metadata,
    created_at
  )
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    auth.uid(),
    v_action::audit_action_enum,
    'grade_submission',
    COALESCE(NEW.id, OLD.id),
    v_old_data,
    v_new_data,
    v_details,
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
-- Fix function for grade workflow transitions
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
      resource_type,
      resource_id,
      old_data,
      new_data,
      metadata,
      created_at
    )
    VALUES (
      NEW.school_id,
      auth.uid(),
      'grade_workflow_transition'::audit_action_enum,
      'grade',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
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
Uses correct audit_logs column names: resource_type, resource_id, old_data, new_data
';

COMMENT ON FUNCTION log_grade_submission_audit_event() IS '
Logs all grade submission actions including:
- Submission creation
- Bulk grade entry
- Submission approval/rejection
- Completion percentage updates
Uses correct audit_logs column names: resource_type, resource_id, old_data, new_data
';

COMMENT ON FUNCTION log_grade_workflow_transition() IS '
Logs detailed workflow state transitions for grades with full context
Uses correct audit_logs column names: resource_type, resource_id, old_data, new_data
';
