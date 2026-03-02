-- Enable api_import module for existing premium/enterprise schools
UPDATE schools
SET enabled_modules = 
      CASE 
        WHEN enabled_modules @> '"api_import"'::jsonb THEN enabled_modules
        ELSE enabled_modules || '"api_import"'::jsonb
      END,
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'api_import', jsonb_build_object(
        'enabled', true,
        'maxFileSize', 52428800,
        'maxRowsPerImport', 10000,
        'quotaMonthly', 100,
        'allowedTypes', to_jsonb(ARRAY['students', 'grades', 'schedules']::text[])
      )
    )
WHERE id IN (
  SELECT school_id
  FROM licenses
  WHERE license_type IN ('premium', 'enterprise')
    AND status = 'active'
    AND expires_at > NOW()
);
-- AND NOT (enabled_modules @> ARRAY['api_import']::text[]) -- Commented out: operator compatibility issue

-- Add comment
COMMENT ON COLUMN schools.settings IS 'JSONB settings object containing feature-specific configurations including exportApi, importApi, qrAttendancePremium, chatModeration, etc.';
