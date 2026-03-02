-- Migration: Enable RLS and create policies for student_cards tables
-- Created: 2025-01-29

-- Enable RLS on card_templates
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for card_templates

-- Super admin: all access
CREATE POLICY "super_admin_all_card_templates"
ON card_templates FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School admin: manage own school templates
CREATE POLICY "school_admin_manage_own_card_templates"
ON card_templates FOR ALL
USING (is_school_admin() AND school_id = get_current_user_school_id())
WITH CHECK (is_school_admin() AND school_id = get_current_user_school_id());

-- School users: read own school templates
CREATE POLICY "school_users_read_own_card_templates"
ON card_templates FOR SELECT
USING (school_id = get_current_user_school_id());

-- Enable RLS on student_cards
ALTER TABLE student_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student_cards

-- Super admin: all access
CREATE POLICY "super_admin_all_student_cards"
ON student_cards FOR ALL
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- School admin: manage own school cards
CREATE POLICY "school_admin_manage_own_student_cards"
ON student_cards FOR ALL
USING (is_school_admin() AND school_id = get_current_user_school_id())
WITH CHECK (is_school_admin() AND school_id = get_current_user_school_id());

-- Teacher: read own school cards
CREATE POLICY "teacher_read_own_school_student_cards"
ON student_cards FOR SELECT
USING (is_teacher() AND school_id = get_current_user_school_id());

-- Accountant: read own school cards
CREATE POLICY "accountant_read_own_school_student_cards"
ON student_cards FOR SELECT
USING (is_accountant() AND school_id = get_current_user_school_id());

-- Student: read own cards
CREATE POLICY "student_read_own_card"
ON student_cards FOR SELECT
USING (
  student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  )
);

-- Parent: read children's cards
CREATE POLICY "parent_read_children_cards"
ON student_cards FOR SELECT
USING (
  student_id IN (
    SELECT spr.student_id
    FROM student_parent_relations spr
    JOIN parents p ON p.id = spr.parent_id
    WHERE p.user_id = auth.uid()
  )
);
