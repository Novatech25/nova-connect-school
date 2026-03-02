-- Migration: Migrate Existing Schools to Premium QR Module
-- Description: Prepares existing schools with premium licenses for the advanced QR attendance module

-- Step 1: Add 'qr_advanced' to enabled_modules for schools with active premium/enterprise licenses
UPDATE public.schools
SET
  enabled_modules = COALESCE(enabled_modules, '[]'::jsonb) ||
    CASE
      WHEN NOT COALESCE(enabled_modules, '[]'::jsonb) @> '["qr_advanced"]'::jsonb
      THEN '["qr_advanced"]'::jsonb
      ELSE '[]'::jsonb
    END,
  updated_at = NOW()
WHERE id IN (
  SELECT school_id
  FROM public.licenses
  WHERE license_type IN ('premium', 'enterprise')
    AND status = 'active'
    AND expires_at > NOW()
)
AND NOT (COALESCE(enabled_modules, '[]'::jsonb) @> '["qr_advanced"]'::jsonb);

-- Step 2: Initialize qrAttendancePremium settings for schools with premium licenses
UPDATE public.schools
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{qrAttendancePremium}',
    '{
      "enabled": false,
      "classQrEnabled": false,
      "cardQrEnabled": false,
      "rotationIntervalSeconds": 60,
      "deviceBindingEnabled": false,
      "anomalyDetectionEnabled": true,
      "maxDevicesPerStudent": 2
    }'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE id IN (
  SELECT school_id
  FROM public.licenses
  WHERE license_type IN ('premium', 'enterprise')
    AND status = 'active'
    AND expires_at > NOW()
)
AND (settings->'qrAttendancePremium') IS NULL;

-- Step 3: Set default qrAttendancePremium settings to enabled=true for premium schools
-- (This enables the module but individual features like classQrEnabled remain false until explicitly activated)
UPDATE public.schools
SET
  settings = jsonb_set(
    settings,
    '{qrAttendancePremium,enabled}',
    'true'::jsonb
  ),
  updated_at = NOW()
WHERE id IN (
  SELECT school_id
  FROM public.licenses
  WHERE license_type IN ('premium', 'enterprise')
    AND status = 'active'
    AND expires_at > NOW()
);

-- Step 4: Add comments to document the migration
COMMENT ON TABLE public.schools IS
  'Schools table with enabled_modules containing qr_advanced for premium license holders';

-- Step 5: Create a helper function to check if a school has premium QR access
CREATE OR REPLACE FUNCTION has_premium_qr_access(school_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_license_type TEXT;
  v_license_status TEXT;
  v_license_expires TIMESTAMP WITH TIME ZONE;
  v_enabled_modules JSONB;
BEGIN
  -- Get license information
  SELECT
    l.license_type,
    l.status,
    l.expires_at,
    s.enabled_modules
  INTO v_license_type, v_license_status, v_license_expires, v_enabled_modules
  FROM public.licenses l
  JOIN public.schools s ON s.id = l.school_id
  WHERE l.school_id = has_premium_qr_access.school_id
    AND l.status = 'active'
    AND l.expires_at > NOW()
  ORDER BY l.expires_at DESC
  LIMIT 1;

  -- Check if license is premium/enterprise and qr_advanced is enabled
  RETURN (
    v_license_type IN ('premium', 'enterprise') AND
    COALESCE(v_enabled_modules, '[]'::jsonb) @> '["qr_advanced"]'::jsonb
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 6: Create a function to get or create default QR premium settings for a school
CREATE OR REPLACE FUNCTION get_or_create_qr_premium_settings(school_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_settings JSONB;
BEGIN
  -- Get current settings
  SELECT settings->'qrAttendancePremium'
  INTO v_settings
  FROM public.schools
  WHERE id = get_or_create_qr_premium_settings.school_id;

  -- If settings don't exist, create them
  IF v_settings IS NULL THEN
    UPDATE public.schools
    SET
      settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{qrAttendancePremium}',
        '{
          "enabled": false,
          "classQrEnabled": false,
          "cardQrEnabled": false,
          "rotationIntervalSeconds": 60,
          "deviceBindingEnabled": false,
          "anomalyDetectionEnabled": true,
          "maxDevicesPerStudent": 2
        }'::jsonb,
        true
      ),
      updated_at = NOW()
    WHERE id = get_or_create_qr_premium_settings.school_id;

    RETURN '{
      "enabled": false,
      "classQrEnabled": false,
      "cardQrEnabled": false,
      "rotationIntervalSeconds": 60,
      "deviceBindingEnabled": false,
      "anomalyDetectionEnabled": true,
      "maxDevicesPerStudent": 2
    }'::jsonb;
  ELSE
    RETURN v_settings;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION has_premium_qr_access TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_or_create_qr_premium_settings TO postgres, authenticated, service_role;

-- Step 8: Add comments for documentation
COMMENT ON FUNCTION has_premium_qr_access IS 'Checks if a school has access to premium QR features based on license type and enabled modules';
COMMENT ON FUNCTION get_or_create_qr_premium_settings IS 'Returns or creates default QR premium settings for a school';

-- Migration complete
-- Note: This migration only prepares the schools table.
-- Individual schools still need to:
-- 1. Activate the qr_advanced module in their settings (if not auto-enabled)
-- 2. Enable specific features (classQrEnabled, cardQrEnabled, etc.)
-- 3. Configure rotation intervals and other parameters
