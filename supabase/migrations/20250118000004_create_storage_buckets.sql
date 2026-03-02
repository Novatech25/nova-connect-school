-- Create storage buckets for student photos and documents
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('student-photos', 'student-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']), -- 5MB limit
  ('student-documents', 'student-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) -- 10MB limit
ON CONFLICT (id) DO NOTHING;

-- RLS policies for student-photos bucket
CREATE POLICY "super_admin_all_on_student_photos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'student-photos'
  AND is_super_admin()
)
WITH CHECK (
  bucket_id = 'student-photos'
  AND is_super_admin()
);

CREATE POLICY "school_admin_manage_own_school_student_photos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'student-photos'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
)
WITH CHECK (
  bucket_id = 'student-photos'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

CREATE POLICY "school_users_read_own_school_student_photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-photos'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

-- RLS policies for student-documents bucket
CREATE POLICY "super_admin_all_on_student_documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'student-documents'
  AND is_super_admin()
)
WITH CHECK (
  bucket_id = 'student-documents'
  AND is_super_admin()
);

CREATE POLICY "school_admin_manage_own_school_student_documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'student-documents'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
)
WITH CHECK (
  bucket_id = 'student-documents'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

CREATE POLICY "school_users_read_own_school_student_documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-documents'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

-- Note: Cannot comment on policies for system table storage.objects in Supabase
