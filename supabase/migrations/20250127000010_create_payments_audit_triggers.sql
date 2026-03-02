-- Migration: Create Payment Audit Triggers
-- Description: Creates audit logging triggers for payment tables
-- Date: 2025-01-27

-- ============================================
-- Audit Logging Function
-- ============================================

CREATE OR REPLACE FUNCTION log_payment_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  action_text TEXT;
  table_name TEXT;
  record_id UUID;
  details JSONB;
BEGIN
  -- Determine action
  IF (TG_OP = 'INSERT') THEN
    action_text := TG_TABLE_NAME || '_created';
    record_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN
    action_text := TG_TABLE_NAME || '_updated';
    record_id := NEW.id;
  ELSIF (TG_OP = 'DELETE') THEN
    action_text := TG_TABLE_NAME || '_deleted';
    record_id := OLD.id;
  END IF;

  -- Build details based on table
  details := '{}'::jsonb;

  -- Common fields
  IF TG_OP != 'DELETE' THEN
    details := details || jsonb_build_object(
      'school_id', NEW.school_id
    );
  END IF;

  -- Table-specific details
  CASE TG_TABLE_NAME
    WHEN 'payments' THEN
      IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        details := details || jsonb_build_object(
          'student_id', NEW.student_id,
          'fee_schedule_id', NEW.fee_schedule_id,
          'amount', NEW.amount,
          'payment_method', NEW.payment_method,
          'payment_date', NEW.payment_date,
          'reference_number', NEW.reference_number,
          'received_by', NEW.received_by
        );
      ELSIF TG_OP = 'DELETE' THEN
        details := details || jsonb_build_object(
          'student_id', OLD.student_id,
          'amount', OLD.amount
        );
      END IF;

    WHEN 'fee_schedules' THEN
      IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        details := details || jsonb_build_object(
          'student_id', NEW.student_id,
          'fee_type_id', NEW.fee_type_id,
          'amount', NEW.amount,
          'status', NEW.status,
          'paid_amount', NEW.paid_amount,
          'remaining_amount', NEW.remaining_amount,
          'discount_amount', NEW.discount_amount,
          'due_date', NEW.due_date
        );

        -- Log status change specifically
        IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
          action_text := 'fee_schedule_status_changed';
          details := details || jsonb_build_object(
            'old_status', OLD.status,
            'new_status', NEW.status
          );
        END IF;
      ELSIF TG_OP = 'DELETE' THEN
        details := details || jsonb_build_object(
          'student_id', OLD.student_id,
          'amount', OLD.amount,
          'status', OLD.status
        );
      END IF;

    WHEN 'fee_types' THEN
      IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        details := details || jsonb_build_object(
          'name', NEW.name,
          'code', NEW.code,
          'category', NEW.category,
          'default_amount', NEW.default_amount,
          'is_mandatory', NEW.is_mandatory,
          'is_active', NEW.is_active
        );
      END IF;

    WHEN 'payment_exemptions' THEN
      IF TG_OP = 'INSERT' THEN
        action_text := 'payment_exemption_created';
        details := details || jsonb_build_object(
          'student_id', NEW.student_id,
          'exemption_type', NEW.exemption_type,
          'amount', NEW.amount,
          'percentage', NEW.percentage,
          'reason', NEW.reason,
          'approved_by', NEW.approved_by,
          'valid_from', NEW.valid_from,
          'valid_until', NEW.valid_until
        );
      ELSIF TG_OP = 'UPDATE' THEN
        details := details || jsonb_build_object(
          'student_id', NEW.student_id,
          'exemption_type', NEW.exemption_type,
          'is_active', NEW.is_active
        );

        -- Log activation/deactivation
        IF OLD.is_active != NEW.is_active THEN
          IF NEW.is_active THEN
            action_text := 'payment_exemption_approved';
          ELSE
            action_text := 'payment_exemption_revoked';
          END IF;
        END IF;
      END IF;

    WHEN 'payment_receipts' THEN
      IF TG_OP = 'INSERT' THEN
        action_text := 'payment_receipt_generated';
        details := details || jsonb_build_object(
          'payment_id', NEW.payment_id,
          'receipt_number', NEW.receipt_number,
          'pdf_url', NEW.pdf_url,
          'generated_by', NEW.generated_by
        );
      END IF;

    WHEN 'payment_reminders' THEN
      IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        details := details || jsonb_build_object(
          'student_id', NEW.student_id,
          'fee_schedule_id', NEW.fee_schedule_id,
          'reminder_type', NEW.reminder_type,
          'status', NEW.status,
          'sent_via', NEW.sent_via
        );

        IF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'sent' THEN
          action_text := 'payment_reminder_sent';
          details := details || jsonb_build_object(
            'sent_at', NEW.sent_at
          );
        END IF;
      END IF;
  END CASE;

  -- Insert into audit_logs (assuming this table exists)
  INSERT INTO audit_logs (
    action,
    table_name,
    record_id,
    details,
    user_id,
    created_at
  ) VALUES (
    action_text,
    TG_TABLE_NAME,
    record_id,
    details,
    auth.uid(),
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Audit logging failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Apply Triggers to Payment Tables
-- ============================================

-- Payments audit trigger
CREATE TRIGGER payments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_audit_event();

-- Fee schedules audit trigger
CREATE TRIGGER fee_schedules_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON fee_schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_audit_event();

-- Fee types audit trigger
CREATE TRIGGER fee_types_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON fee_types
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_audit_event();

-- Payment exemptions audit trigger
CREATE TRIGGER payment_exemptions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_exemptions
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_audit_event();

-- Payment receipts audit trigger
CREATE TRIGGER payment_receipts_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_audit_event();

-- Payment reminders audit trigger
CREATE TRIGGER payment_reminders_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_reminders
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_audit_event();

-- Add helpful comments
COMMENT ON FUNCTION log_payment_audit_event() IS 'Logs all payment-related operations to the audit_logs table';
COMMENT ON TRIGGER payments_audit_trigger ON payments IS 'Captures all payment creation, updates, and deletions';
COMMENT ON TRIGGER fee_schedules_audit_trigger ON fee_schedules IS 'Captures fee schedule changes and status updates';
COMMENT ON TRIGGER payment_exemptions_audit_trigger ON payment_exemptions IS 'Captures exemption creation, approval, and revocation';
COMMENT ON TRIGGER payment_receipts_audit_trigger ON payment_receipts IS 'Captures receipt generation events';
COMMENT ON TRIGGER payment_reminders_audit_trigger ON payment_reminders IS 'Captures reminder sending events';
