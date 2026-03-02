-- Migration: Ensure all schools have QR secret for student card generation
-- Created: 2026-02-13
-- Description: Generate qrSecret for schools that don't have one and ensure it's never NULL

-- Function to generate a random QR secret
CREATE OR REPLACE FUNCTION generate_qr_secret()
RETURNS TEXT AS $$
DECLARE
  v_secret TEXT;
BEGIN
  -- Generate 64-character hex string (256 bits)
  v_secret := upper(substring(encode(gen_random_bytes(64), 'hex'), 1, 64));
  RETURN v_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure school has QR secret
CREATE OR REPLACE FUNCTION ensure_school_qr_secret()
RETURNS VOID AS $$
DECLARE
  v_school_record RECORD;
  v_new_secret TEXT;
BEGIN
  -- Loop through schools without qrSecret or with NULL qrSecret
  FOR v_school_record IN
    SELECT id, settings, code
    FROM schools
    WHERE settings IS NULL
       OR jsonb_exists(settings, 'qrSecret') = false
       OR settings->>'qrSecret' IS NULL
       OR settings->>'qrSecret' = ''
  LOOP
    -- Generate new secret
    v_new_secret := generate_qr_secret();

    -- Update school settings
    UPDATE schools
    SET settings = coalesce(
        jsonb_set(
          COALESCE(settings, '{}'),
          '{qrSecret}',
          to_jsonb(v_new_secret)
        ),
        jsonb_build_object(
          'qrSecret', v_new_secret
        )
      ),
    updated_at = NOW()
    WHERE id = v_school_record.id;

    RAISE NOTICE 'Generated QR secret for school: % (%)', v_school_record.code, v_school_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to ensure all existing schools have QR secret
SELECT ensure_school_qr_secret();

-- Create trigger to automatically generate qrSecret when school is created
CREATE OR REPLACE FUNCTION auto_generate_school_qr_secret()
RETURNS TRIGGER AS $$
BEGIN
  -- If qrSecret is not set in settings, generate it
  IF (NEW.settings IS NULL) OR
     (NOT jsonb_exists(COALESCE(NEW.settings, '{}'), 'qrSecret')) OR
     (COALESCE(NEW.settings->>'qrSecret', '') IS NULL) OR
     (COALESCE(NEW.settings->>'qrSecret', '') = '') THEN

    NEW.settings := jsonb_set(
      COALESCE(NEW.settings, '{}'),
      '{qrSecret}',
      to_jsonb(generate_qr_secret())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic qrSecret generation
DROP TRIGGER IF EXISTS schools_auto_qr_secret ON schools;
CREATE TRIGGER schools_auto_qr_secret
BEFORE INSERT OR UPDATE ON schools
FOR EACH ROW
EXECUTE FUNCTION auto_generate_school_qr_secret();

-- Add constraint to ensure qrSecret is never NULL
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_qr_secret_not_null;
ALTER TABLE schools
  ADD CONSTRAINT schools_qr_secret_not_null
  CHECK (
    settings IS NOT NULL AND
    jsonb_exists(settings, 'qrSecret') AND
    settings->>'qrSecret' IS NOT NULL AND
    settings->>'qrSecret' != ''
  );

-- Add helpful comment
COMMENT ON COLUMN schools.settings IS 'School settings JSON. Must include qrSecret for student card generation. Example: {"qrSecret": "ABC123..."}';
