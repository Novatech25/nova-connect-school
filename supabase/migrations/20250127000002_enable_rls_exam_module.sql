-- Migration: Enable RLS for Exam Module
-- Created: 2025-01-27
-- Description: Enables Row Level Security policies for all exam module tables

-- Helper function to check if a school has exam_mode enabled
CREATE OR REPLACE FUNCTION check_exam_mode_enabled(p_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM licenses l
    JOIN schools s ON s.id = l.school_id
    WHERE l.school_id = p_school_id
      AND l.status = 'active'
      AND l.expires_at >= NOW()
      AND l.license_type IN ('premium', 'enterprise')
      AND 'exam_mode' = ANY(s.enabled_modules)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_juries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_minutes ENABLE ROW LEVEL SECURITY;

-- Policies exam_sessions
CREATE POLICY "Users can view exam sessions from their school with exam_mode enabled"
  ON exam_sessions FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "School admins can manage exam sessions with exam_mode enabled"
  ON exam_sessions FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Policies exam_centers
CREATE POLICY "Users can view exam centers from their school with exam_mode enabled"
  ON exam_centers FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "School admins can manage exam centers with exam_mode enabled"
  ON exam_centers FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Policies exam_juries
CREATE POLICY "Users can view exam juries from their school with exam_mode enabled"
  ON exam_juries FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "School admins can manage exam juries with exam_mode enabled"
  ON exam_juries FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Policies exam_assignments
CREATE POLICY "Users can view exam assignments from their school with exam_mode enabled"
  ON exam_assignments FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "Students can view their own exam assignments"
  ON exam_assignments FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "School admins can manage exam assignments with exam_mode enabled"
  ON exam_assignments FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Policies exam_grades
CREATE POLICY "Users can view exam grades from their school with exam_mode enabled"
  ON exam_grades FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "Jury members can manage exam grades with exam_mode enabled"
  ON exam_grades FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Policies exam_deliberations
CREATE POLICY "Users can view exam deliberations from their school with exam_mode enabled"
  ON exam_deliberations FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "Jury members can manage exam deliberations with exam_mode enabled"
  ON exam_deliberations FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Policies exam_results
CREATE POLICY "Users can view exam results from their school with exam_mode enabled"
  ON exam_results FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "Students can view their own exam results"
  ON exam_results FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "Parents can view their children's exam results"
  ON exam_results FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parent_relations spr
      JOIN parents p ON p.id = spr.parent_id
      WHERE p.user_id = auth.uid()
    )
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "School admins can manage exam results with exam_mode enabled"
  ON exam_results FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Policies exam_minutes
CREATE POLICY "Users can view exam minutes from their school with exam_mode enabled"
  ON exam_minutes FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND check_exam_mode_enabled(school_id)
  );

CREATE POLICY "School admins can manage exam minutes with exam_mode enabled"
  ON exam_minutes FOR ALL
  USING (
    school_id IN (
      SELECT ur.school_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled(school_id)
  );

-- Storage policies for exam-documents
CREATE POLICY "Users can view exam documents from their school with exam_mode enabled"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exam-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT school_id::text FROM users WHERE id = auth.uid()
    )
    AND check_exam_mode_enabled((storage.foldername(name))[1]::UUID)
  );

CREATE POLICY "School admins can upload exam documents with exam_mode enabled"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exam-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT ur.school_id::text FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name IN ('school_admin', 'supervisor')
    )
    AND check_exam_mode_enabled((storage.foldername(name))[1]::UUID)
  );
