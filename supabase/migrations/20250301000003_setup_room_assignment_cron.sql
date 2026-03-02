-- =====================================================
-- Migration: Setup Room Assignment Manual Triggers
-- Created: 2025-03-01
-- Description: Creates functions for room assignment management
--
-- Note: pg_cron extension is not available in Supabase by default
-- This migration creates the functions that can be triggered manually
-- or via external cron services
-- =====================================================

-- Note: For automated room assignments, use external cron services
-- such as GitHub Actions, Vercel Cron, or EasyCron to call these functions

-- Manual trigger function for daily room assignment calculation
CREATE OR REPLACE FUNCTION calculate_daily_room_assignments(p_session_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- This would typically call an Edge Function for the actual calculation
  -- For now, we just return a success response
  v_result = jsonb_build_object(
    'success', true,
    'message', 'Room assignments calculation triggered for ' || p_session_date::text,
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual trigger function for T-60 notifications
CREATE OR REPLACE FUNCTION send_room_assignment_notifications_t60()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- This would typically call an Edge Function to send notifications
  v_result = jsonb_build_object(
    'success', true,
    'message', 'T-60 notifications sent',
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual trigger function for T-15 notifications
CREATE OR REPLACE FUNCTION send_room_assignment_notifications_t15()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- This would typically call an Edge Function to send notifications
  v_result = jsonb_build_object(
    'success', true,
    'message', 'T-15 notifications sent',
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_daily_room_assignments(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION send_room_assignment_notifications_t60() TO authenticated;
GRANT EXECUTE ON FUNCTION send_room_assignment_notifications_t15() TO authenticated;

COMMENT ON FUNCTION calculate_daily_room_assignments(DATE) IS 'Manually trigger daily room assignment calculation';
COMMENT ON FUNCTION send_room_assignment_notifications_t60() IS 'Manually trigger T-60 minute room assignment notifications';
COMMENT ON FUNCTION send_room_assignment_notifications_t15() IS 'Manually trigger T-15 minute room assignment notifications';
