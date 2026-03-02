-- Enable chat_moderation for existing premium/enterprise schools
UPDATE schools
SET enabled_modules = 
      CASE 
        WHEN enabled_modules @> '"chat_moderation"'::jsonb THEN enabled_modules
        ELSE enabled_modules || '"chat_moderation"'::jsonb
      END,
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'chatModeration', jsonb_build_object(
        'enabled', true,
        'autoModerationEnabled', true,
        'allowFileAttachments', true,
        'maxFileSize', 10485760,
        'allowedFileTypes', to_jsonb(ARRAY['image', 'document', 'pdf']::text[])
      )
    )
WHERE id IN (
  SELECT school_id
  FROM licenses
  WHERE license_type IN ('premium', 'enterprise')
    AND status = 'active'
    AND expires_at > NOW()
)
AND NOT (enabled_modules @> '"chat_moderation"'::jsonb);

-- Add comment for documentation
COMMENT ON COLUMN schools.settings IS 'JSONB settings object containing feature-specific configurations including qrAttendancePremium, chatModeration, etc.';
