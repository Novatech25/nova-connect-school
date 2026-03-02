-- Create imports bucket
-- Note: Bucket INSERT removed

-- RLS policies for imports bucket
CREATE POLICY "School admins can upload import files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'imports'
    AND (
      SELECT COALESCE((storage.foldername(name))[1], '')::uuid
    ) IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
    -- Note: Additional import_jobs status check removed as table doesn't exist yet
  );

CREATE POLICY "School admins can view their import files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'imports'
    AND (
      SELECT COALESCE((storage.foldername(name))[1], '')::uuid
    ) IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "School admins can delete their import files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'imports'
    AND (
      SELECT COALESCE((storage.foldername(name))[1], '')::uuid
    ) IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- Function to cleanup expired imports
CREATE OR REPLACE FUNCTION cleanup_expired_imports()
RETURNS void AS $$
BEGIN
  -- Delete files from storage for completed/failed jobs older than 7 days
  DELETE FROM storage.objects
  WHERE bucket_id = 'imports'
    AND name IN (
      SELECT storage.filepath.concat(id, '/', file_name)
      FROM import_jobs
      WHERE status IN ('completed', 'failed', 'rolled_back')
        AND completed_at < NOW() - INTERVAL '7 days'
    );

  -- Optionally delete the import_jobs records (soft delete by setting expires_at)
  UPDATE import_jobs
  SET expires_at = NOW()
  WHERE status IN ('completed', 'failed', 'rolled_back')
    AND completed_at < NOW() - INTERVAL '30 days'
    AND expires_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
