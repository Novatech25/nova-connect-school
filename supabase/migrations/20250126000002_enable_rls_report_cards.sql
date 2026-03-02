-- Migration: Enable RLS for report cards tables
-- Description: Creates Row Level Security policies for report cards and versions

-- Enable RLS
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_card_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES FOR report_cards
-- ============================================================================

-- Super Admin: full access
CREATE POLICY "super_admin_all_on_report_cards"
ON report_cards FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: manage own school
CREATE POLICY "school_admin_all_on_report_cards"
ON report_cards FOR ALL
USING (is_school_admin() AND school_id = get_current_user_school_id())
WITH CHECK (is_school_admin() AND school_id = get_current_user_school_id());

-- Accountant: generate and manage report cards for own school
CREATE POLICY "accountant_manage_on_report_cards"
ON report_cards FOR ALL
USING (is_accountant() AND school_id = get_current_user_school_id())
WITH CHECK (is_accountant() AND school_id = get_current_user_school_id());

-- Teachers: read published report cards for their classes
CREATE POLICY "teacher_read_published_report_cards"
ON report_cards FOR SELECT
USING (
  is_teacher()
  AND school_id = get_current_user_school_id()
  AND status = 'published'
  AND class_id IN (
    SELECT class_id FROM teacher_assignments
    WHERE teacher_id = auth.uid() AND school_id = get_current_user_school_id()
  )
);

-- Students: read own published report cards (if payment allows)
CREATE POLICY "student_read_own_published_report_cards"
ON report_cards FOR SELECT
USING (
  is_student()
  AND school_id = get_current_user_school_id()
  AND status = 'published'
  AND student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  AND (payment_status != 'blocked' OR payment_status_override = true)
);

-- Parents: read children's published report cards (if payment allows)
CREATE POLICY "parent_read_children_published_report_cards"
ON report_cards FOR SELECT
USING (
  is_parent()
  AND school_id = get_current_user_school_id()
  AND status = 'published'
  AND student_id IN (
    SELECT student_id FROM student_parent_relations
    WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
  )
  AND (payment_status != 'blocked' OR payment_status_override = true)
);

-- ============================================================================
-- POLICIES FOR report_card_versions
-- ============================================================================

-- Super Admin: full access
CREATE POLICY "super_admin_all_on_report_card_versions"
ON report_card_versions FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School Admin: read versions for own school
CREATE POLICY "school_admin_read_report_card_versions"
ON report_card_versions FOR SELECT
USING (is_school_admin() AND school_id = get_current_user_school_id());

-- Accountant: read versions for own school
CREATE POLICY "accountant_read_report_card_versions"
ON report_card_versions FOR SELECT
USING (is_accountant() AND school_id = get_current_user_school_id());

-- ============================================================================
-- POLICIES FOR STORAGE (report-cards bucket)
-- ============================================================================

-- Super Admin: full access to storage
CREATE POLICY "super_admin_all_on_report_cards_storage"
ON storage.objects FOR ALL
USING (bucket_id = 'report-cards' AND is_super_admin())
WITH CHECK (bucket_id = 'report-cards' AND is_super_admin());

-- School Admin: manage own school report cards storage
CREATE POLICY "school_admin_manage_own_school_report_cards_storage"
ON storage.objects FOR ALL
USING (
  bucket_id = 'report-cards'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
)
WITH CHECK (
  bucket_id = 'report-cards'
  AND is_school_admin()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

-- Accountant: manage own school report cards storage
CREATE POLICY "accountant_manage_own_school_report_cards_storage"
ON storage.objects FOR ALL
USING (
  bucket_id = 'report-cards'
  AND is_accountant()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
)
WITH CHECK (
  bucket_id = 'report-cards'
  AND is_accountant()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

-- All school users: read own school report cards storage
CREATE POLICY "school_users_read_own_school_report_cards_storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'report-cards'
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
);

-- Students: read own report card PDFs (if payment allows and published)
CREATE POLICY "students_read_own_report_cards_storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'report-cards'
  AND is_student()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
  AND (storage.foldername(name))[2] IN (
    SELECT id::text FROM students WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM report_cards
    WHERE report_cards.pdf_url = name
      AND report_cards.status = 'published'
      AND (report_cards.payment_status != 'blocked' OR report_cards.payment_status_override = true)
  )
);

-- Parents: read children's report card PDFs (if payment allows and published)
CREATE POLICY "parents_read_children_report_cards_storage"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'report-cards'
  AND is_parent()
  AND (storage.foldername(name))[1] = get_current_user_school_id()::text
  AND (storage.foldername(name))[2] IN (
    SELECT student_id::text FROM student_parent_relations
    WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM report_cards
    WHERE report_cards.pdf_url = name
      AND report_cards.status = 'published'
      AND (report_cards.payment_status != 'blocked' OR report_cards.payment_status_override = true)
  )
);

-- Add comments
COMMENT ON COLUMN report_cards.payment_status_override IS 'Admin override to allow access despite payment block';
COMMENT ON COLUMN report_cards.override_reason IS 'Reason for overriding payment block - required for audit';
