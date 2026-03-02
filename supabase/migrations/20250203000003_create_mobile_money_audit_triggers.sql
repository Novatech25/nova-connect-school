-- ============================================================================
-- Mobile Money Audit Triggers
-- ============================================================================
-- Audit logging for all Mobile Money operations
-- Tracks creation, updates, reconciliation, and status changes
-- ============================================================================

-- ============================================================================
-- Audit trigger function for providers
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_mobile_money_provider_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user from auth
  user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      new_data
    ) VALUES (
      NEW.school_id,
      user_id,
      'INSERT',
      'mobile_money_provider',
      NEW.id,
      jsonb_build_object(
        'provider_code', NEW.provider_code,
        'provider_name', NEW.provider_name,
        'is_active', NEW.is_active,
        'is_test_mode', NEW.is_test_mode
      )
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      old_data,
      new_data
    ) VALUES (
      NEW.school_id,
      user_id,
      'UPDATE',
      'mobile_money_provider',
      NEW.id,
      jsonb_build_object(
        'provider_code', OLD.provider_code,
        'provider_name', OLD.provider_name,
        'is_active', OLD.is_active,
        'is_test_mode', OLD.is_test_mode
      ),
      jsonb_build_object(
        'provider_code', NEW.provider_code,
        'provider_name', NEW.provider_name,
        'is_active', NEW.is_active,
        'is_test_mode', NEW.is_test_mode
      )
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      old_data
    ) VALUES (
      OLD.school_id,
      user_id,
      'DELETE',
      'mobile_money_provider',
      OLD.id,
      jsonb_build_object(
        'provider_code', OLD.provider_code,
        'provider_name', OLD.provider_name,
        'is_active', OLD.is_active
      )
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Audit trigger function for transactions
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_mobile_money_transaction_changes()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  action_type TEXT;
  details JSONB;
BEGIN
  -- Get current user from auth (may be NULL for webhook operations)
  user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    -- New transaction initiated
    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      new_data
    ) VALUES (
      NEW.school_id,
      user_id,
      'INSERT',
      'mobile_money_transaction',
      NEW.id,
      jsonb_build_object(
        'transaction_reference', NEW.transaction_reference,
        'student_id', NEW.student_id,
        'amount', NEW.amount,
        'provider_id', NEW.provider_id,
        'status', NEW.status,
        'phone_number', NEW.phone_number
      )
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine action type based on what changed
    IF OLD.status != NEW.status THEN
      action_type := 'STATUS_CHANGE';

      -- Special logging for status transitions
      IF NEW.status = 'success' THEN
        INSERT INTO audit_logs (
          school_id,
          user_id,
          action,
          resource_type,
          resource_id,
          old_data,
          new_data
        ) VALUES (
          NEW.school_id,
          user_id,
          'PAYMENT_SUCCESS',
          'mobile_money_transaction',
          NEW.id,
          jsonb_build_object('old_status', OLD.status),
          jsonb_build_object(
            'new_status', NEW.status,
            'amount', NEW.amount,
            'payment_id', NEW.payment_id
          )
        );
      ELSIF NEW.status = 'failed' THEN
        INSERT INTO audit_logs (
          school_id,
          user_id,
          action,
          resource_type,
          resource_id,
          new_data
        ) VALUES (
          NEW.school_id,
          user_id,
          'PAYMENT_FAILED',
          'mobile_money_transaction',
          NEW.id,
          jsonb_build_object(
            'error_code', NEW.error_code,
            'error_message', NEW.error_message,
            'retry_count', NEW.retry_count
          )
        );
      END IF;
    END IF;

    IF OLD.reconciliation_status != NEW.reconciliation_status THEN
      action_type := 'RECONCILIATION';

      INSERT INTO audit_logs (
        school_id,
        user_id,
        action,
        resource_type,
        resource_id,
        old_data,
        new_data
      ) VALUES (
        NEW.school_id,
        user_id,
        'RECONCILIATION',
        'mobile_money_transaction',
        NEW.id,
        jsonb_build_object(
          'old_reconciliation_status', OLD.reconciliation_status,
          'old_payment_id', OLD.payment_id
        ),
        jsonb_build_object(
          'new_reconciliation_status', NEW.reconciliation_status,
          'payment_id', NEW.payment_id,
          'reconciled_by', NEW.reconciled_by
        )
      );
    END IF;

    IF OLD.retry_count != NEW.retry_count THEN
      INSERT INTO audit_logs (
        school_id,
        user_id,
        action,
        resource_type,
        resource_id,
        new_data
      ) VALUES (
        NEW.school_id,
        user_id,
        'RETRY_ATTEMPT',
        'mobile_money_transaction',
        NEW.id,
        jsonb_build_object(
          'retry_count', NEW.retry_count,
          'max_retries', NEW.max_retries
        )
      );
    END IF;

    -- General update log
    IF action_type IS NULL THEN
      action_type := 'UPDATE';
    END IF;

    INSERT INTO audit_logs (
      school_id,
      user_id,
      action,
      resource_type,
      resource_id,
      old_data,
      new_data
    ) VALUES (
      NEW.school_id,
      user_id,
      action_type,
      'mobile_money_transaction',
      NEW.id,
      jsonb_build_object(
        'status', OLD.status,
        'reconciliation_status', OLD.reconciliation_status
      ),
      jsonb_build_object(
        'status', NEW.status,
        'reconciliation_status', NEW.reconciliation_status
      )
    );

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Create triggers
-- ============================================================================

-- Provider audit triggers
CREATE TRIGGER mobile_money_providers_audit_insert
  AFTER INSERT ON mobile_money_providers
  FOR EACH ROW
  EXECUTE FUNCTION audit_mobile_money_provider_changes();

CREATE TRIGGER mobile_money_providers_audit_update
  AFTER UPDATE ON mobile_money_providers
  FOR EACH ROW
  EXECUTE FUNCTION audit_mobile_money_provider_changes();

CREATE TRIGGER mobile_money_providers_audit_delete
  AFTER DELETE ON mobile_money_providers
  FOR EACH ROW
  EXECUTE FUNCTION audit_mobile_money_provider_changes();

-- Transaction audit triggers
CREATE TRIGGER mobile_money_transactions_audit_insert
  AFTER INSERT ON mobile_money_transactions
  FOR EACH ROW
  EXECUTE FUNCTION audit_mobile_money_transaction_changes();

CREATE TRIGGER mobile_money_transactions_audit_update
  AFTER UPDATE ON mobile_money_transactions
  FOR EACH ROW
  EXECUTE FUNCTION audit_mobile_money_transaction_changes();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION audit_mobile_money_provider_changes() IS
'Audit trigger function for logging all changes to Mobile Money provider configurations';

COMMENT ON FUNCTION audit_mobile_money_transaction_changes() IS
'Audit trigger function for logging all Mobile Money transaction events including status changes, reconciliation, and retries';
