-- Migration: Create audit triggers for student_cards tables
-- Created: 2025-01-29

-- Audit trigger function for card_templates
CREATE OR REPLACE FUNCTION audit_card_templates()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'card_template',
      NEW.id,
      'create',
      'card_templates',
      'Created card template: ' || NEW.name,
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'card_template',
      NEW.id,
      'update',
      'card_templates',
      'Updated card template: ' || NEW.name,
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'card_template',
      OLD.id,
      'delete',
      'card_templates',
      'Deleted card template: ' || OLD.name,
      OLD.school_id
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger for card_templates
CREATE TRIGGER card_templates_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON card_templates
  FOR EACH ROW
  EXECUTE FUNCTION audit_card_templates();

-- Audit trigger function for student_cards
CREATE OR REPLACE FUNCTION audit_student_cards()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'student_card',
      NEW.id,
      'create',
      'student_cards',
      'Generated student card: ' || NEW.card_number || ' for student: ' || NEW.student_id::text,
      NEW.school_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log specific events
    IF OLD.status != NEW.status THEN
      PERFORM log_audit_event(
        'student_card',
        NEW.id,
        'status_change',
        'student_cards',
        'Card status changed from ' || OLD.status || ' to ' || NEW.status || ': ' || NEW.card_number,
        NEW.school_id
      );
    END IF;

    IF OLD.payment_status_override != NEW.payment_status_override AND NEW.payment_status_override = true THEN
      PERFORM log_audit_event(
        'student_card',
        NEW.id,
        'payment_override',
        'student_cards',
        'Payment status override enabled for card: ' || NEW.card_number || '. Reason: ' || COALESCE(NEW.override_reason, 'N/A'),
        NEW.school_id
      );
    END IF;

    IF NEW.status = 'revoked' AND OLD.status != 'revoked' THEN
      PERFORM log_audit_event(
        'student_card',
        NEW.id,
        'revoke',
        'student_cards',
        'Card revoked: ' || NEW.card_number || '. Reason: ' || COALESCE(NEW.revocation_reason, 'N/A'),
        NEW.school_id
      );
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'student_card',
      OLD.id,
      'delete',
      'student_cards',
      'Deleted student card: ' || OLD.card_number,
      OLD.school_id
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger for student_cards
CREATE TRIGGER student_cards_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON student_cards
  FOR EACH ROW
  EXECUTE FUNCTION audit_student_cards();
