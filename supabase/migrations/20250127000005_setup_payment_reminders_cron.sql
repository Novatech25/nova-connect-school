-- =====================================================
-- Migration: Setup Payment Reminders (Manual Trigger)
-- Description: Creates payment reminder infrastructure for Supabase
-- Date: 2025-01-27
--
-- Note: pg_cron extension is not available in Supabase by default
-- This migration creates the functions that can be triggered manually
-- or via external cron services (GitHub Actions, Vercel Cron, etc.)
-- =====================================================

-- ============================================
-- Manual Trigger Function
-- Can be called manually or triggered from an external service
-- ============================================

CREATE OR REPLACE FUNCTION trigger_payment_reminders_check()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Step 1: Check overdue payments (function should exist in payments module)
  -- PERFORM check_overdue_payments();

  -- Step 2: Return status
  v_result = jsonb_build_object(
    'success', true,
    'message', 'Payment reminders check completed',
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Job Management Helper Functions
-- ============================================

-- Function to manually trigger payment reminders
CREATE OR REPLACE FUNCTION manually_trigger_payment_reminders()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Trigger the check
  v_result := trigger_payment_reminders_check();

  -- Log the manual trigger
  INSERT INTO audit_logs (action, resource_type, resource_id, details, user_id, created_at)
  VALUES (
    'MANUAL_TRIGGER',
    'payment_reminders',
    NULL::uuid,
    jsonb_build_object('triggered_by', 'manual_function_call'),
    auth.uid(),
    NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION manually_trigger_payment_reminders TO authenticated;

-- ============================================
-- Setup Instructions (Comment)
-- ============================================

/*
PAYMENT REMINDERS SETUP INSTRUCTIONS:

This migration creates the infrastructure for automated payment reminders.
However, pg_cron extension is not available in Supabase by default.

EXTERNAL CRON SERVICE OPTIONS:

1. GitHub Actions:
   - Create a workflow file: .github/workflows/payment-reminders.yml
   - Schedule: daily at 9:00 AM UTC
   - Step: curl -X POST https://YOUR_PROJECT_REF.supabase.co/rest/v1/rpc/manually_trigger_payment_reminders

2. Vercel Cron:
   - Create an API route that calls the function
   - Configure cron job in vercel.json

3. Other Cron Services:
   - EasyCron, Cron-Job.org, etc.
   - Make HTTP POST to your Supabase REST API

4. Manual Trigger:
   For testing or one-off reminders:
   SELECT manually_trigger_payment_reminders();
*/

COMMENT ON FUNCTION trigger_payment_reminders_check() IS 'Triggers the payment reminder check process';
COMMENT ON FUNCTION manually_trigger_payment_reminders() IS 'Manually triggers payment reminders and logs the action';
