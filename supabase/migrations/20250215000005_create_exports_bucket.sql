-- ============================================
-- Module Premium - API Export Avancé
-- Migration: Create Exports Storage Bucket
-- ============================================

-- ============================================
-- Create storage bucket for export files
-- ============================================
-- Note: Bucket INSERT removed

-- ============================================
-- RLS Policies for exports bucket
-- ============================================

-- Users can read files from their school's exports
-- This is enforced by checking the export_jobs table
CREATE POLICY "Users can view export files from their school"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'exports'
    AND (
      -- School admins can access all exports from their school
      EXISTS (
        SELECT 1
        FROM export_jobs ej
        JOIN user_roles ur ON ej.school_id = ur.school_id JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'school_admin'
        AND ej.file_path = objects.name
      )
      OR
      -- Accountants can access all exports from their school
      EXISTS (
        SELECT 1
        FROM export_jobs ej
        JOIN user_roles ur ON ej.school_id = ur.school_id JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'accountant'
        AND ej.file_path = objects.name
      )
      OR
      -- Users who initiated the export can access it
      EXISTS (
        SELECT 1
        FROM export_jobs ej
        WHERE ej.initiated_by = auth.uid()
        AND ej.file_path = objects.name
      )
    )
  );

-- Service role can insert files (via Edge Functions)
CREATE POLICY "Service role can upload export files"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'exports');

-- Service role can update files
CREATE POLICY "Service role can update export files"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'exports')
  WITH CHECK (bucket_id = 'exports');

-- Service role can delete files
CREATE POLICY "Service role can delete export files"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'exports');

-- ============================================
-- Helper Functions for File Operations
-- ============================================

-- Function to generate export file path
CREATE OR REPLACE FUNCTION generate_export_file_path(
  school_id UUID,
  export_type export_type_enum,
  resource_type export_resource_enum,
  job_id UUID
)
RETURNS TEXT AS $$
DECLARE
  year TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  month TEXT := LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0');
  file_extension TEXT;
BEGIN
  -- Determine file extension based on export type
  CASE export_type
    WHEN 'excel' THEN file_extension := 'xlsx';
    WHEN 'pdf' THEN file_extension := 'pdf';
    WHEN 'csv' THEN file_extension := 'csv';
    ELSE file_extension := 'txt';
  END CASE;

  -- Generate path: {school_id}/{year}/{month}/{job_id}.{extension}
  RETURN format('%s/%s/%s/%s.%s', school_id, year, month, job_id, file_extension);
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can download export file
CREATE OR REPLACE FUNCTION can_download_export(user_id UUID, job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  job_record RECORD;
  can_access BOOLEAN := FALSE;
BEGIN
  -- Get export job
  SELECT ej.*, s.school_id
  INTO job_record
  FROM export_jobs ej
  JOIN schools s ON ej.school_id = s.id
  WHERE ej.id = job_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if job is completed and not expired
  IF job_record.status != 'completed' THEN
    RETURN FALSE;
  END IF;

  IF job_record.expires_at <= NOW() THEN
    RETURN FALSE;
  END IF;

  -- Check if user can access this school's exports
  -- School admin
  IF EXISTS (
    SELECT 1 FROM school_admins
    WHERE school_id = job_record.school_id
    AND user_id = can_download_export.user_id
  ) THEN
    can_access := TRUE;
  END IF;

  -- Accountant
  IF NOT can_access AND EXISTS (
    SELECT 1 FROM school_accountants
    WHERE school_id = job_record.school_id
    AND user_id = can_download_export.user_id
  ) THEN
    can_access := TRUE;
  END IF;

  -- User who initiated the export
  IF NOT can_access AND job_record.initiated_by = user_id THEN
    can_access := TRUE;
  END IF;

  RETURN can_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Cleanup Function for Expired Exports
-- ============================================

-- Function to delete expired export files
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  expired_file RECORD;
BEGIN
  -- Loop through expired export jobs
  FOR expired_file IN
    SELECT file_path, id
    FROM export_jobs
    WHERE status = 'completed'
    AND expires_at <= NOW()
    AND file_path IS NOT NULL
  LOOP
    BEGIN
      -- Delete file from storage
      -- Note: This requires the storage extension to be properly configured
      DELETE FROM storage.objects
      WHERE bucket_id = 'exports'
      AND (storage.foldername(name) || storage.filename(name)) = expired_file.file_path;

      -- Update job status to expired
      UPDATE export_jobs
      SET status = 'expired'
      WHERE id = expired_file.id;

      deleted_count := deleted_count + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      RAISE NOTICE 'Error deleting expired export file %: %', expired_file.file_path, SQLERRM;
    END;
  END LOOP;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================

COMMENT ON FUNCTION generate_export_file_path IS 'Generate standardized file path for export files';
COMMENT ON FUNCTION can_download_export IS 'Check if user can download export file based on RLS';
COMMENT ON FUNCTION cleanup_expired_exports IS 'Delete expired export files from storage';

-- ============================================
-- Setup instructions (as comments)
-- ============================================
/*

Storage Configuration:

1. File naming convention:
   - Path: {school_id}/{year}/{month}/{job_id}.{extension}
   - Example: 12345678-1234-1234-1234-123456789012/2025/02/a1b2c3d4-...xlsx

2. File expiration:
   - Default: 30 days after creation
   - Configurable via export_jobs.expires_at
   - Automated cleanup via cleanup_expired_exports()

3. To manually clean up expired exports:
   SELECT cleanup_expired_exports();

4. Storage lifecycle policies (configured in Supabase dashboard):
   - Automatically delete files after 30 days
   - Move to cold storage after 7 days (optional)

5. Signed URLs:
   - Generated with 1-hour expiration
   - User must have permission to download (checked via can_download_export)

6. File size limits:
   - Maximum: 100 MB per file
   - Configurable via Edge Function validation

7. Security:
   - Bucket is private (public = false)
   - Access controlled via RLS policies
   - Users can only download files from their school
*/
