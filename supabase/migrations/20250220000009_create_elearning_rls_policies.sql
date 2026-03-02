-- E-Learning Module RLS Policies Migration
-- Creates Row Level Security policies for all e-learning tables and storage buckets

-- Enable RLS on all tables
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_resources ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ASSIGNMENTS POLICIES
-- ============================================

-- SELECT: Teachers see their assignments, Students/Parents see published assignments from their classes
CREATE POLICY "Teachers can view their assignments"
  ON assignments FOR SELECT
  USING (
    auth.uid() = teacher_id
  );

CREATE POLICY "Students can view published assignments from their classes"
  ON assignments FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.class_id = assignments.class_id
        AND enrollments.student_id = (
          SELECT id FROM students WHERE user_id = auth.uid()
        )
        AND enrollments.status = 'enrolled'
    )
  );

CREATE POLICY "Parents can view published assignments from their children's classes"
  ON assignments FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM student_parent_relations
      JOIN enrollments ON student_parent_relations.student_id = enrollments.student_id
      WHERE student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND enrollments.class_id = assignments.class_id
        AND enrollments.status = 'enrolled'
        AND student_parent_relations.is_primary = true
    )
  );

-- INSERT: Only teachers can create assignments
CREATE POLICY "Teachers can create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM teacher_assignments
      WHERE teacher_assignments.teacher_id = auth.uid()
        AND teacher_assignments.class_id = class_id
        AND teacher_assignments.school_id = school_id
    )
  );

-- UPDATE: Teachers can update their assignments only
CREATE POLICY "Teachers can update their assignments"
  ON assignments FOR UPDATE
  USING (
    auth.uid() = teacher_id
  )
  WITH CHECK (
    auth.uid() = teacher_id
  );

-- DELETE: Teachers can delete their draft assignments only
CREATE POLICY "Teachers can delete their draft assignments"
  ON assignments FOR DELETE
  USING (
    auth.uid() = teacher_id
    AND status = 'draft'
  );

-- ============================================
-- ASSIGNMENT FILES POLICIES
-- ============================================

-- SELECT: Teacher owner + Students/Parents of the class
CREATE POLICY "Teachers can view their assignment files"
  ON assignment_files FOR SELECT
  USING (
    auth.uid() = uploaded_by
  );

CREATE POLICY "Students can view assignment files from their classes"
  ON assignment_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN enrollments ON assignments.class_id = enrollments.class_id
      WHERE assignments.id = assignment_files.assignment_id
        AND enrollments.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
        AND assignments.status = 'published'
    )
  );

CREATE POLICY "Parents can view assignment files from their children's classes"
  ON assignment_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      JOIN enrollments ON assignments.class_id = enrollments.class_id
      JOIN student_parent_relations ON enrollments.student_id = student_parent_relations.student_id
      WHERE assignments.id = assignment_files.assignment_id
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
        AND student_parent_relations.is_primary = true
        AND assignments.status = 'published'
    )
  );

-- INSERT: Only teacher owner can upload files
CREATE POLICY "Teachers can upload assignment files"
  ON assignment_files FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_id
        AND assignments.teacher_id = auth.uid()
    )
  );

-- DELETE: Only teacher owner can delete files
CREATE POLICY "Teachers can delete their assignment files"
  ON assignment_files FOR DELETE
  USING (
    auth.uid() = uploaded_by
  );

-- ============================================
-- ASSIGNMENT SUBMISSIONS POLICIES
-- ============================================

-- SELECT: Student owner + Parents + Teacher of the assignment
CREATE POLICY "Students can view their submissions"
  ON assignment_submissions FOR SELECT
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "Parents can view their children's submissions"
  ON assignment_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM student_parent_relations
      WHERE student_parent_relations.student_id = assignment_submissions.student_id
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND student_parent_relations.is_primary = true
    )
  );

CREATE POLICY "Teachers can view submissions from their assignments"
  ON assignment_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_submissions.assignment_id
        AND assignments.teacher_id = auth.uid()
    )
  );

-- INSERT: Only students can create submissions for their classes
CREATE POLICY "Students can create submissions"
  ON assignment_submissions FOR INSERT
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM assignments
      JOIN enrollments ON assignments.class_id = enrollments.class_id
      WHERE assignments.id = assignment_submissions.assignment_id
        AND enrollments.student_id = assignment_submissions.student_id
        AND enrollments.status = 'enrolled'
    )
  );

-- UPDATE: Students (their submission) + Teachers (for grading)
CREATE POLICY "Students can update their submissions"
  ON assignment_submissions FOR UPDATE
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    AND status IN ('pending', 'submitted')
  )
  WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    AND status IN ('pending', 'submitted')
  );

CREATE POLICY "Teachers can update submissions for grading"
  ON assignment_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_submissions.assignment_id
        AND assignments.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_submissions.assignment_id
        AND assignments.teacher_id = auth.uid()
    )
  );

-- DELETE: Not allowed
CREATE POLICY "No one can delete submissions"
  ON assignment_submissions FOR DELETE
  USING (false);

-- ============================================
-- SUBMISSION FILES POLICIES
-- ============================================

-- SELECT: Student owner + Parents + Teacher of the assignment
CREATE POLICY "Students can view their submission files"
  ON submission_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions
      WHERE assignment_submissions.id = submission_files.submission_id
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Parents can view their children's submission files"
  ON submission_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions
      JOIN student_parent_relations ON assignment_submissions.student_id = student_parent_relations.student_id
      WHERE assignment_submissions.id = submission_files.submission_id
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND student_parent_relations.is_primary = true
    )
  );

CREATE POLICY "Teachers can view submission files from their assignments"
  ON submission_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions
      JOIN assignments ON assignment_submissions.assignment_id = assignments.id
      WHERE assignment_submissions.id = submission_files.submission_id
        AND assignments.teacher_id = auth.uid()
    )
  );

-- INSERT: Only student owner can upload files
CREATE POLICY "Students can upload submission files"
  ON submission_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignment_submissions
      WHERE assignment_submissions.id = submission_files.submission_id
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND assignment_submissions.status IN ('pending', 'submitted')
    )
  );

-- DELETE: Only student owner can delete files (before submission only)
CREATE POLICY "Students can delete their pending submission files"
  ON submission_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions
      WHERE assignment_submissions.id = submission_files.submission_id
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND assignment_submissions.status = 'pending'
    )
  );

-- ============================================
-- CORRECTION FILES POLICIES
-- ============================================

-- SELECT: Student owner + Parents + Teacher
CREATE POLICY "Students can view correction files for their submissions"
  ON correction_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions
      WHERE assignment_submissions.id = correction_files.submission_id
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Parents can view correction files for their children's submissions"
  ON correction_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignment_submissions
      JOIN student_parent_relations ON assignment_submissions.student_id = student_parent_relations.student_id
      WHERE assignment_submissions.id = correction_files.submission_id
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND student_parent_relations.is_primary = true
    )
  );

CREATE POLICY "Teachers can view correction files from their assignments"
  ON correction_files FOR SELECT
  USING (
    auth.uid() = uploaded_by
  );

-- INSERT: Only teacher can upload correction files
CREATE POLICY "Teachers can upload correction files"
  ON correction_files FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM assignment_submissions
      JOIN assignments ON assignment_submissions.assignment_id = assignments.id
      WHERE assignment_submissions.id = correction_files.submission_id
        AND assignments.teacher_id = auth.uid()
    )
  );

-- DELETE: Only teacher can delete correction files
CREATE POLICY "Teachers can delete their correction files"
  ON correction_files FOR DELETE
  USING (
    auth.uid() = uploaded_by
  );

-- ============================================
-- COURSE RESOURCES POLICIES
-- ============================================

-- SELECT: Teacher owner + Students/Parents of the class (if published)
CREATE POLICY "Teachers can view their resources"
  ON course_resources FOR SELECT
  USING (
    auth.uid() = teacher_id
  );

CREATE POLICY "Students can view published resources from their classes"
  ON course_resources FOR SELECT
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.class_id = course_resources.class_id
        AND enrollments.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
    )
  );

CREATE POLICY "Parents can view published resources from their children's classes"
  ON course_resources FOR SELECT
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM enrollments
      JOIN student_parent_relations ON enrollments.student_id = student_parent_relations.student_id
      WHERE enrollments.class_id = course_resources.class_id
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
        AND student_parent_relations.is_primary = true
    )
  );

-- INSERT: Only teachers can create resources
CREATE POLICY "Teachers can create resources"
  ON course_resources FOR INSERT
  WITH CHECK (
    auth.uid() = teacher_id
    AND EXISTS (
      SELECT 1 FROM teacher_assignments
      WHERE teacher_assignments.teacher_id = auth.uid()
        AND teacher_assignments.class_id = class_id
        AND teacher_assignments.school_id = school_id
    )
  );

-- UPDATE: Only teacher owner can update resources
CREATE POLICY "Teachers can update their resources"
  ON course_resources FOR UPDATE
  USING (
    auth.uid() = teacher_id
  )
  WITH CHECK (
    auth.uid() = teacher_id
  );

-- DELETE: Only teacher owner can delete resources
CREATE POLICY "Teachers can delete their resources"
  ON course_resources FOR DELETE
  USING (
    auth.uid() = teacher_id
  );

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Assignment Files Bucket (path: schoolId/assignmentId/filename)
CREATE POLICY "Teachers can upload assignment files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignment-files'
    AND EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id::text = (storage.foldername(name))[1]
        AND assignments.school_id::text = (storage.foldername(name))[0]
        AND assignments.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view their assignment files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-files'
    AND EXISTS (
      SELECT 1 FROM assignment_files
      JOIN assignments ON assignment_files.assignment_id = assignments.id
      WHERE assignment_files.file_path = storage.objects.name
        AND assignments.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view assignment files from their classes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-files'
    AND EXISTS (
      SELECT 1 FROM assignment_files
      JOIN assignments ON assignment_files.assignment_id = assignments.id
      JOIN enrollments ON assignments.class_id = enrollments.class_id
      WHERE assignment_files.file_path = storage.objects.name
        AND enrollments.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
        AND assignments.status = 'published'
    )
  );

CREATE POLICY "Parents can view assignment files from their children's classes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-files'
    AND EXISTS (
      SELECT 1 FROM assignment_files
      JOIN assignments ON assignment_files.assignment_id = assignments.id
      JOIN enrollments ON assignments.class_id = enrollments.class_id
      JOIN student_parent_relations ON enrollments.student_id = student_parent_relations.student_id
      WHERE assignment_files.file_path = storage.objects.name
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
        AND student_parent_relations.is_primary = true
        AND assignments.status = 'published'
    )
  );

CREATE POLICY "Teachers can delete their assignment files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assignment-files'
    AND EXISTS (
      SELECT 1 FROM assignment_files
      JOIN assignments ON assignment_files.assignment_id = assignments.id
      WHERE assignment_files.file_path = storage.objects.name
        AND assignments.teacher_id = auth.uid()
    )
  );

-- Submission Files Bucket (path: schoolId/submissionId/filename)
CREATE POLICY "Students can upload submission files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'submission-files'
    AND EXISTS (
      SELECT 1 FROM assignment_submissions
      JOIN assignments ON assignment_submissions.assignment_id = assignments.id
      WHERE assignment_submissions.id::text = (storage.foldername(name))[1]
        AND assignment_submissions.school_id::text = (storage.foldername(name))[0]
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND assignment_submissions.status IN ('pending', 'submitted')
    )
  );

CREATE POLICY "Students can view their submission files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND EXISTS (
      SELECT 1 FROM submission_files
      JOIN assignment_submissions ON submission_files.submission_id = assignment_submissions.id
      WHERE submission_files.file_path = storage.objects.name
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can view submission files from their assignments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND EXISTS (
      SELECT 1 FROM submission_files
      JOIN assignment_submissions ON submission_files.submission_id = assignment_submissions.id
      JOIN assignments ON assignment_submissions.assignment_id = assignments.id
      WHERE submission_files.file_path = storage.objects.name
        AND assignments.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Parents can view their children's submission files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'submission-files'
    AND EXISTS (
      SELECT 1 FROM submission_files
      JOIN assignment_submissions ON submission_files.submission_id = assignment_submissions.id
      JOIN student_parent_relations ON assignment_submissions.student_id = student_parent_relations.student_id
      WHERE submission_files.file_path = storage.objects.name
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND student_parent_relations.is_primary = true
    )
  );

CREATE POLICY "Students can delete their submission files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'submission-files'
    AND EXISTS (
      SELECT 1 FROM submission_files
      JOIN assignment_submissions ON submission_files.submission_id = assignment_submissions.id
      WHERE submission_files.file_path = storage.objects.name
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND assignment_submissions.status = 'pending'
    )
  );

-- Correction Files Bucket (path: schoolId/submissionId/filename)
CREATE POLICY "Teachers can upload correction files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'correction-files'
    AND EXISTS (
      SELECT 1 FROM assignment_submissions
      JOIN assignments ON assignment_submissions.assignment_id = assignments.id
      WHERE assignment_submissions.id::text = (storage.foldername(name))[1]
        AND assignment_submissions.school_id::text = (storage.foldername(name))[0]
        AND assignments.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view correction files for their submissions"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'correction-files'
    AND EXISTS (
      SELECT 1 FROM correction_files
      JOIN assignment_submissions ON correction_files.submission_id = assignment_submissions.id
      WHERE correction_files.file_path = storage.objects.name
        AND assignment_submissions.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Teachers can view their correction files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'correction-files'
    AND EXISTS (
      SELECT 1 FROM correction_files
      JOIN assignment_submissions ON correction_files.submission_id = assignment_submissions.id
      JOIN assignments ON assignment_submissions.assignment_id = assignments.id
      WHERE correction_files.file_path = storage.objects.name
        AND assignments.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Parents can view correction files for their children"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'correction-files'
    AND EXISTS (
      SELECT 1 FROM correction_files
      JOIN assignment_submissions ON correction_files.submission_id = assignment_submissions.id
      JOIN student_parent_relations ON assignment_submissions.student_id = student_parent_relations.student_id
      WHERE correction_files.file_path = storage.objects.name
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND student_parent_relations.is_primary = true
    )
  );

CREATE POLICY "Teachers can delete their correction files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'correction-files'
    AND EXISTS (
      SELECT 1 FROM correction_files
      JOIN assignment_submissions ON correction_files.submission_id = assignment_submissions.id
      JOIN assignments ON assignment_submissions.assignment_id = assignments.id
      WHERE correction_files.file_path = storage.objects.name
        AND assignments.teacher_id = auth.uid()
    )
  );

-- Course Resources Bucket (path: schoolId/resourceId/filename)
CREATE POLICY "Teachers can upload course resources"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'course-resources'
    AND EXISTS (
      SELECT 1 FROM course_resources
      WHERE course_resources.id::text = (storage.foldername(name))[1]
        AND course_resources.school_id::text = (storage.foldername(name))[0]
        AND course_resources.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view their course resources"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-resources'
    AND EXISTS (
      SELECT 1 FROM course_resources
      WHERE course_resources.file_path = storage.objects.name
        AND course_resources.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view published course resources"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-resources'
    AND EXISTS (
      SELECT 1 FROM course_resources
      JOIN enrollments ON course_resources.class_id = enrollments.class_id
      WHERE course_resources.file_path = storage.objects.name
        AND enrollments.student_id = (SELECT id FROM students WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
        AND course_resources.is_published = true
    )
  );

CREATE POLICY "Parents can view published course resources for their children"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'course-resources'
    AND EXISTS (
      SELECT 1 FROM course_resources
      JOIN enrollments ON course_resources.class_id = enrollments.class_id
      JOIN student_parent_relations ON enrollments.student_id = student_parent_relations.student_id
      WHERE course_resources.file_path = storage.objects.name
        AND student_parent_relations.parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND enrollments.status = 'enrolled'
        AND student_parent_relations.is_primary = true
        AND course_resources.is_published = true
    )
  );

CREATE POLICY "Teachers can delete their course resources"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'course-resources'
    AND EXISTS (
      SELECT 1 FROM course_resources
      WHERE course_resources.file_path = storage.objects.name
        AND course_resources.teacher_id = auth.uid()
    )
  );
