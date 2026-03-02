-- Migration: Add Payroll Status Transitions
-- Created: 2025-01-30
-- Description: Adds functions to handle payroll status transitions

-- Function to validate and mark payroll period as pending_payment
CREATE OR REPLACE FUNCTION validate_payroll_period(payroll_period_id UUID)
RETURNS JSONB AS $$
DECLARE
  period_status TEXT;
BEGIN
  -- Get current period status
  SELECT status INTO period_status
  FROM payroll_periods
  WHERE id = payroll_period_id;

  IF period_status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only draft periods can be validated'
    );
  END IF;

  -- Update all draft entries to pending_payment
  UPDATE payroll_entries
  SET status = 'pending_payment'
  WHERE payroll_period_id = payroll_period_id
    AND status = 'draft';

  -- Update period status
  UPDATE payroll_periods
  SET status = 'pending_payment',
      validated_at = NOW()
  WHERE id = payroll_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Payroll period validated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if all entries in a period are paid and update period status
CREATE OR REPLACE FUNCTION check_period_payment_status(payroll_period_id UUID)
RETURNS VOID AS $$
DECLARE
  total_entries INTEGER;
  paid_entries INTEGER;
BEGIN
  -- Count total and paid entries
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'paid') as paid
  INTO total_entries, paid_entries
  FROM payroll_entries
  WHERE payroll_period_id = payroll_period_id;

  -- If all entries are paid, update period status to paid
  IF total_entries > 0 AND paid_entries = total_entries THEN
    UPDATE payroll_periods
    SET status = 'paid'
    WHERE id = payroll_period_id
      AND status != 'paid';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically check period payment status when an entry is updated
CREATE OR REPLACE FUNCTION check_payment_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if status changed to paid
  IF (TG_OP = 'UPDATE' AND NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid'))
     OR (TG_OP = 'INSERT' AND NEW.status = 'paid')
  THEN
    PERFORM check_period_payment_status(NEW.payroll_period_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payroll_entries_payment_status_trigger
  AFTER INSERT OR UPDATE OF status ON payroll_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_payment_status_trigger();
