-- Fix grades audit triggers to match audit_logs schema (resource_type/resource_id)

CREATE OR REPLACE FUNCTION log_grade_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action_value audit_action_enum;
  event_type TEXT;
  details JSONB;
BEGIN
  action_value := TG_OP::audit_action_enum;

  IF TG_OP = 'INSERT' THEN
    event_type := 'grade_created';
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
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'submitted' THEN
        event_type := 'grade_submitted';
      ELSIF NEW.status = 'approved' THEN
        event_type := 'grade_approved';
      ELSIF NEW.status = 'published' THEN
        event_type := 'grade_published';
      ELSIF NEW.status = 'rejected' THEN
        event_type := 'grade_rejected';
      ELSE
        event_type := 'grade_status_changed';
      END IF;
    ELSIF OLD.is_locked = false AND NEW.is_locked = true THEN
      event_type := 'grade_locked';
    ELSIF OLD.is_locked = true AND NEW.is_locked = false THEN
      event_type := 'grade_unlocked';
    ELSIF OLD.score IS DISTINCT FROM NEW.score THEN
      event_type := 'grade_score_modified';
    ELSE
      event_type := 'grade_updated';
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
    event_type := 'grade_deleted';
    details := jsonb_build_object(
      'grade_id', OLD.id,
      'student_id', OLD.student_id,
      'subject_id', OLD.subject_id,
      'title', OLD.title,
      'score', OLD.score,
      'status', OLD.status
    );
  END IF;

  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    metadata,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    auth.uid(),
    action_value,
    'grade',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object('event', event_type, 'details', details),
    inet_client_addr(),
    current_setting('request.headers', TRUE)::JSON->>'user-agent',
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_grade_submission_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action_value audit_action_enum;
  event_type TEXT;
  details JSONB;
BEGIN
  action_value := TG_OP::audit_action_enum;

  IF TG_OP = 'INSERT' THEN
    event_type := 'grade_submission_created';
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
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'submitted' THEN
        event_type := 'grade_submission_submitted';
      ELSIF NEW.status = 'approved' THEN
        event_type := 'grade_submission_approved';
      ELSIF NEW.status = 'rejected' THEN
        event_type := 'grade_submission_rejected';
      ELSE
        event_type := 'grade_submission_status_changed';
      END IF;
    ELSE
      event_type := 'grade_submission_updated';
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
    event_type := 'grade_submission_deleted';
    details := jsonb_build_object(
      'submission_id', OLD.id,
      'teacher_id', OLD.teacher_id,
      'class_id', OLD.class_id,
      'subject_id', OLD.subject_id,
      'status', OLD.status
    );
  END IF;

  INSERT INTO audit_logs (
    school_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    metadata,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id),
    auth.uid(),
    action_value,
    'grade_submission',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object('event', event_type, 'details', details),
    inet_client_addr(),
    current_setting('request.headers', TRUE)::JSON->>'user-agent',
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_grade_workflow_transition()
RETURNS TRIGGER AS $$
BEGIN
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
      'UPDATE',
      'grade',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_build_object(
        'event', 'grade_workflow_transition',
        'transition', jsonb_build_object('from', OLD.status, 'to', NEW.status),
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
