-- E-Learning Module Notifications Migration
-- Adds notification types and triggers for e-learning events

-- Add new notification types to the enum
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'assignment_published';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'assignment_deadline_soon';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'assignment_submitted';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'assignment_graded';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'resource_published';

-- ============================================
-- NOTIFICATION HELPER FUNCTIONS
-- ============================================

-- Function to send notification to all students in a class
CREATE OR REPLACE FUNCTION notify_class_students(
  p_class_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_assignment_id UUID DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_student RECORD;
BEGIN
  FOR v_student IN
    SELECT student_id, user_id
    FROM enrollments
    JOIN students ON enrollments.student_id = students.id
    WHERE enrollments.class_id = p_class_id
      AND enrollments.status = 'active'
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_student.user_id,
      p_notification_type,
      p_title,
      p_message,
      jsonb_build_object(
        'assignment_id', p_assignment_id,
        'resource_id', p_resource_id
      ),
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to send notification to student's guardians
CREATE OR REPLACE FUNCTION notify_student_guardians(
  p_student_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_assignment_id UUID DEFAULT NULL,
  p_submission_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_parent RECORD;
BEGIN
  FOR v_parent IN
    SELECT parents.user_id
    FROM student_parent_relations
    JOIN parents ON student_parent_relations.parent_id = parents.id
    WHERE student_parent_relations.student_id = p_student_id
      AND student_parent_relations.is_primary = true
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_parent.user_id,
      p_notification_type,
      p_title,
      p_message,
      jsonb_build_object(
        'assignment_id', p_assignment_id,
        'submission_id', p_submission_id
      ),
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to send notification TO authenticated
CREATE OR REPLACE FUNCTION notify_teacher(
  p_teacher_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_assignment_id UUID DEFAULT NULL,
  p_submission_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data, created_at)
  VALUES (
    p_teacher_id,
    p_notification_type,
    p_title,
    p_message,
    jsonb_build_object(
      'assignment_id', p_assignment_id,
      'submission_id', p_submission_id
    ),
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ASSIGNMENT PUBLISHED TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION handle_assignment_published()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment RECORD;
  v_student RECORD;
BEGIN
  -- Only trigger when status becomes 'published'
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    -- Get assignment details
    SELECT a.title, a.description, c.name as class_name, s.name as subject_name
    INTO v_assignment
    FROM assignments a
    JOIN classes c ON a.class_id = c.id
    JOIN subjects s ON a.subject_id = s.id
    WHERE a.id = NEW.id;

    -- Notify all students in the class
    PERFORM notify_class_students(
      NEW.class_id,
      'assignment_published',
      'Nouveau devoir disponible',
      'Un nouveau devoir "' || v_assignment.title || '" a été publié pour ' || v_assignment.class_name,
      NEW.id
    );

    -- Notify guardians
    FOR v_student IN
      SELECT student_id
      FROM enrollments
      WHERE class_id = NEW.class_id
        AND status = 'enrolled'
    LOOP
      PERFORM notify_student_guardians(
        v_student.student_id,
        'assignment_published',
        'Nouveau devoir disponible',
        'Un nouveau devoir "' || v_assignment.title || '" a été publié',
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignment_published_trigger
  AFTER INSERT OR UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_assignment_published();

-- ============================================
-- ASSIGNMENT SUBMITTED TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION handle_assignment_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment RECORD;
  v_student RECORD;
BEGIN
  -- Only trigger when status becomes 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- Get assignment and student details
    SELECT a.title, a.teacher_id, s.first_name, s.last_name, c.name as class_name
    INTO v_assignment
    FROM assignments a
    JOIN students s ON NEW.student_id = s.id
    JOIN classes c ON a.class_id = c.id
    WHERE a.id = NEW.assignment_id;

    -- Notify the teacher
    PERFORM notify_teacher(
      v_assignment.teacher_id,
      'assignment_submitted',
      'Nouvelle soumission de devoir',
      v_assignment.first_name || ' ' || v_assignment.last_name || ' a soumis le devoir "' || v_assignment.title || '"',
      NEW.assignment_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignment_submitted_trigger
  AFTER UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_assignment_submitted();

-- ============================================
-- ASSIGNMENT GRADED TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION handle_assignment_graded()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment RECORD;
  v_student RECORD;
BEGIN
  -- Only trigger when status becomes 'graded' or 'returned'
  IF (NEW.status = 'graded' OR NEW.status = 'returned')
    AND (OLD.status IS NULL OR (OLD.status != 'graded' AND OLD.status != 'returned'))
  THEN
    -- Get assignment and student details
    SELECT a.title, s.user_id, s.first_name, s.last_name
    INTO v_assignment
    FROM assignments a
    JOIN students s ON NEW.student_id = s.id
    WHERE a.id = NEW.assignment_id;

    -- Notify the student
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_assignment.user_id,
      'assignment_graded',
      'Devoir corrigé disponible',
      'Votre devoir "' || v_assignment.title || '" a été corrigé. Note : ' || NEW.score || '/20',
      jsonb_build_object(
        'assignment_id', NEW.assignment_id,
        'submission_id', NEW.id,
        'score', NEW.score
      ),
      NOW()
    );

    -- Notify guardians
    PERFORM notify_student_guardians(
      NEW.student_id,
      'assignment_graded',
      'Devoir corrigé disponible',
      'Le devoir "' || v_assignment.title || '" de ' || v_assignment.first_name || ' ' || v_assignment.last_name || ' a été corrigé. Note : ' || NEW.score || '/20',
      NEW.assignment_id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assignment_graded_trigger
  AFTER UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_assignment_graded();

-- ============================================
-- COURSE RESOURCE PUBLISHED TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION handle_resource_published()
RETURNS TRIGGER AS $$
DECLARE
  v_resource RECORD;
  v_student RECORD;
BEGIN
  -- Only trigger when is_published becomes true
  IF NEW.is_published = true AND (OLD.is_published IS NULL OR OLD.is_published = false) THEN
    -- Get resource details
    SELECT r.title, r.description, c.name as class_name, s.name as subject_name
    INTO v_resource
    FROM course_resources r
    JOIN classes c ON r.class_id = c.id
    JOIN subjects s ON r.subject_id = s.id
    WHERE r.id = NEW.id;

    -- Notify all students in the class
    PERFORM notify_class_students(
      NEW.class_id,
      'resource_published',
      'Nouvelle ressource de cours disponible',
      'Une nouvelle ressource "' || v_resource.title || '" a été publiée pour ' || v_resource.class_name,
      NULL,
      NEW.id
    );

    -- Notify guardians
    FOR v_student IN
      SELECT student_id
      FROM enrollments
      WHERE class_id = NEW.class_id
        AND status = 'active'
    LOOP
      PERFORM notify_student_guardians(
        v_student.student_id,
        'resource_published',
        'Nouvelle ressource de cours disponible',
        'Une nouvelle ressource "' || v_resource.title || '" a été publiée',
        NULL,
        NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resource_published_trigger
  AFTER INSERT OR UPDATE ON course_resources
  FOR EACH ROW
  EXECUTE FUNCTION handle_resource_published();
