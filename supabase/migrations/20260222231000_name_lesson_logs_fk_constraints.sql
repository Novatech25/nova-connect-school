-- Migration: Explicitly name the lesson_logs → users foreign key constraints
-- so PostgREST can disambiguate between teacher_id and validated_by both pointing to users.
-- This allows using the !fkey hint in PostgREST queries.

DO $$
BEGIN
  -- Rename FK for teacher_id if it exists under a different name
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lesson_logs_teacher_id_fkey'
    AND conrelid = 'lesson_logs'::regclass
  ) THEN
    -- Find existing FK name on teacher_id and rename it
    ALTER TABLE lesson_logs
      ADD CONSTRAINT lesson_logs_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- Rename FK for validated_by if it exists under a different name
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lesson_logs_validated_by_fkey'
    AND conrelid = 'lesson_logs'::regclass
  ) THEN
    ALTER TABLE lesson_logs
      ADD CONSTRAINT lesson_logs_validated_by_fkey
      FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
