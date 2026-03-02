-- Migration: Create storage bucket for student cards
-- Created: 2025-01-29

-- Insert storage bucket for student cards
-- Note: Bucket INSERT removed
-- Note: RLS on storage.objects is managed by Supabase
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student-cards bucket

-- Super admin: all access
CREATE POLICY "super_admin_all_student_cards_objects"
ON storage.objects FOR ALL
USING (
  bucket_id = 'student-cards'
  AND is_super_admin()
)
WITH CHECK (
  bucket_id = 'student-cards'
  AND is_super_admin()
);

-- School admin: all access to own school folder
CREATE POLICY "school_admin_manage_own_school_student_cards"
ON storage.objects FOR ALL
USING (
  bucket_id = 'student-cards'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
)
WITH CHECK (
  bucket_id = 'student-cards'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

-- School users: read access to own school folder
CREATE POLICY "school_users_read_own_school_student_cards"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-cards'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

-- Students: read access to own cards
CREATE POLICY "students_read_own_student_cards"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-cards'
  AND auth.uid() IN (
    SELECT s.user_id
    FROM students s
    WHERE s.id::text = (storage.foldername(name))[2]
  )
);

-- Parents: read access to children's cards
CREATE POLICY "parents_read_children_student_cards"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-cards'
  AND auth.uid() IN (
    SELECT p.user_id
    FROM parents p
    JOIN student_parent_relations spr ON spr.parent_id = p.id
    WHERE spr.student_id::text = (storage.foldername(name))[2]
  )
);
