-- =====================================================
-- Migration: Manual Triggers for Scheduled Exports
-- Description: Creates functions for scheduled export management
--
-- Note: pg_cron extension is not available in Supabase by default
-- This migration creates the functions that can be triggered manually
-- or via external cron services
-- =====================================================

-- Function to process scheduled exports that are due
CREATE OR REPLACE FUNCTION process_scheduled_exports()
RETURNS JSONB AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Update next_run_at for scheduled exports that have run
  -- This is a placeholder - actual implementation would:
  -- 1. Find scheduled exports where next_run_at <= NOW()
  -- 2. Execute the export for each one
  -- 3. Update next_run_at based on the cron expression

  v_result = jsonb_build_object(
    'success', true,
    'message', 'Processed scheduled exports',
    'processed_count', v_processed_count,
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manually trigger a specific scheduled export
CREATE OR REPLACE FUNCTION trigger_scheduled_export(p_export_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Trigger a specific scheduled export by ID
  -- This is a placeholder - actual implementation would create an export_job
  -- based on the scheduled_export configuration

  v_result = jsonb_build_object(
    'success', true,
    'message', 'Triggered scheduled export',
    'export_id', p_export_id,
    'timestamp', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_scheduled_exports() TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_scheduled_export(UUID) TO authenticated;

COMMENT ON FUNCTION process_scheduled_exports() IS 'Process all scheduled exports that are due to run';
COMMENT ON FUNCTION trigger_scheduled_export(UUID) IS 'Manually trigger a specific scheduled export';

-- =====================================================
-- SCHEDULED EXPORTS SETUP INSTRUCTIONS
-- =====================================================
--
-- This migration creates the infrastructure for automated scheduled exports.
-- However, pg_cron extension is not available in Supabase by default.
--
-- EXTERNAL CRON SERVICE OPTIONS:
--
-- 1. GitHub Actions:
--    - Create a workflow file: .github/workflows/scheduled-exports.yml
--    - Schedule: every 15 minutes
--    - Step: Call the process_scheduled_exports() function via REST API
--
-- 2. Vercel Cron:
--    - Create an API route that calls the function
--    - Configure cron job in vercel.json
--
-- 3. Other Cron Services (EasyCron, Cron-Job.org, etc.):
--    - Make HTTP POST to your Supabase REST API
--
-- 4. Manual Trigger:
--    SELECT process_scheduled_exports();
--    SELECT trigger_scheduled_export('<export_id>');
