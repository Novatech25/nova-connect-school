-- =====================================================
-- Triggers pour notifications automatiques des notes et devoirs
-- =====================================================

-- Ajouter le type de notification 'assignment_added' s'il n'existe pas
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assignment_added') THEN
        ALTER TYPE notification_type_enum ADD VALUE 'assignment_added';
    END IF;
END $$;

-- =====================================================
-- Fonction trigger : Notifications pour publication de notes
-- Déclenche des notifications aux élèves et parents quand des notes sont publiées
-- =====================================================
CREATE OR REPLACE FUNCTION notify_grades_published()
RETURNS TRIGGER AS $$
DECLARE
    grade_record RECORD;
    class_record RECORD;
    subject_record RECORD;
    school_record RECORD;
    student_ids TEXT[];
    parent_ids TEXT[];
    notification_data JSONB;
    notifications_list JSONB;
BEGIN
    -- Ne déclencher que lorsque le statut passe à 'published'
    IF NEW.status != 'published' OR (OLD.status IS NOT NULL AND OLD.status = 'published') THEN
        RETURN NEW;
    END IF;

    -- Récupérer les informations de la note
    SELECT * INTO grade_record
    FROM grades
    WHERE id = NEW.id;

    -- Récupérer les informations de la classe
    SELECT * INTO class_record
    FROM classes
    WHERE id = grade_record.class_id;

    -- Récupérer les informations de la matière
    SELECT * INTO subject_record
    FROM subjects
    WHERE id = grade_record.subject_id;

    -- Récupérer les informations de l'école
    SELECT * INTO school_record
    FROM schools
    WHERE id = class_record.school_id;

    -- Récupérer tous les élèves de la classe
    SELECT ARRAY_AGG(DISTINCT student_id) INTO student_ids
    FROM enrollments
    WHERE class_id = grade_record.class_id
    AND status = 'active';

    -- Récupérer tous les parents des élèves de la classe
    SELECT ARRAY_AGG(DISTINCT pr.parent_id) INTO parent_ids
    FROM student_parent_relations pr
    JOIN enrollments e ON e.student_id = pr.student_id
    WHERE e.class_id = grade_record.class_id
    AND e.status = 'active'
    AND pr.status = 'active';

    -- Préparer les données de la notification
    notification_data = jsonb_build_object(
        'grade_id', grade_record.id,
        'class_id', grade_record.class_id,
        'class_name', class_record.name,
        'subject_id', grade_record.subject_id,
        'subject_name', subject_record.name,
        'period_id', grade_record.period_id,
        'school_id', school_record.id
    );

    -- Construire la liste des notifications pour les élèves et parents
    -- NE PAS insérer directement, laisser send-notification le faire
    notifications_list = (
        SELECT jsonb_agg(
            jsonb_build_object(
                'userId', user_id,
                'type', 'grade_posted',
                'title', 'Nouvelles notes publiées',
                'body', format('Les notes de %s pour la période %s ont été publiées.', subject_record.name, grade_record.period_id::text),
                'data', notification_data,
                'priority', 'normal',
                'channels', ARRAY['in_app', 'push']
            )
        )
        FROM (
            SELECT student_id AS user_id FROM UNNEST(student_ids) AS student_id
            UNION ALL
            SELECT parent_id AS user_id FROM UNNEST(parent_ids) AS parent_id
        ) recipients
    );

    -- Appeler l'Edge Function pour créer et envoyer les notifications
    IF notifications_list IS NOT NULL THEN
        PERFORM net.http_post(
            url := format('%s/functions/v1/send-notification', current_setting('app.supabase_url')),
            headers := jsonb_build_object(
                'Authorization', format('Bearer %s', current_setting('app.supabase_service_role_key')),
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'notifications', notifications_list,
                'schoolId', school_record.id
            ),
            timeout_milliseconds := 10000
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Logger l'erreur sans bloquer l'opération
        RAISE WARNING 'Erreur dans notify_grades_published: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour les notes
DROP TRIGGER IF EXISTS notify_grades_published_trigger ON grades;
CREATE TRIGGER notify_grades_published_trigger
    AFTER UPDATE ON grades
    FOR EACH ROW
    EXECUTE FUNCTION notify_grades_published();

-- =====================================================
-- Fonction trigger : Notifications pour ajout de devoirs
-- Déclenche des notifications aux élèves et parents quand un devoir est ajouté
-- =====================================================
CREATE OR REPLACE FUNCTION notify_lesson_assignment_added()
RETURNS TRIGGER AS $$
DECLARE
    lesson_record RECORD;
    class_record RECORD;
    subject_record RECORD;
    teacher_record RECORD;
    school_record RECORD;
    student_ids TEXT[];
    parent_ids TEXT[];
    notification_data JSONB;
    assignment_description TEXT;
    notifications_list JSONB;
BEGIN
    -- Ne déclencher que si c'est un INSERT ou un UPDATE avec une description de devoir
    IF TG_OP = 'UPDATE' AND (OLD.assignment_description IS NOT NULL OR NEW.assignment_description IS NULL) THEN
        RETURN NEW;
    END IF;

    assignment_description := COALESCE(NEW.assignment_description, '');
    IF assignment_description = '' THEN
        RETURN NEW;
    END IF;

    -- Récupérer les informations de la leçon
    SELECT * INTO lesson_record
    FROM lesson_logs
    WHERE id = NEW.id;

    -- Récupérer les informations de la classe
    SELECT * INTO class_record
    FROM classes
    WHERE id = lesson_record.class_id;

    -- Récupérer les informations de la matière
    SELECT * INTO subject_record
    FROM subjects
    WHERE id = lesson_record.subject_id;

    -- Récupérer les informations du professeur
    SELECT * INTO teacher_record
    FROM users
    WHERE id = lesson_record.teacher_id;

    -- Récupérer les informations de l'école
    SELECT * INTO school_record
    FROM schools
    WHERE id = class_record.school_id;

    -- Récupérer tous les élèves de la classe
    SELECT ARRAY_AGG(DISTINCT student_id) INTO student_ids
    FROM enrollments
    WHERE class_id = lesson_record.class_id
    AND status = 'active';

    -- Récupérer tous les parents des élèves de la classe
    SELECT ARRAY_AGG(DISTINCT pr.parent_id) INTO parent_ids
    FROM student_parent_relations pr
    JOIN enrollments e ON e.student_id = pr.student_id
    WHERE e.class_id = lesson_record.class_id
    AND e.status = 'active'
    AND pr.status = 'active';

    -- Préparer les données de la notification
    notification_data = jsonb_build_object(
        'lesson_id', lesson_record.id,
        'class_id', lesson_record.class_id,
        'class_name', class_record.name,
        'subject_id', lesson_record.subject_id,
        'subject_name', subject_record.name,
        'teacher_id', lesson_record.teacher_id,
        'teacher_name', format('%s %s', teacher_record.first_name, teacher_record.last_name),
        'assignment_description', assignment_description,
        'lesson_date', lesson_record.lesson_date,
        'school_id', school_record.id
    );

    -- Construire la liste des notifications pour les élèves et parents
    -- NE PAS insérer directement, laisser send-notification le faire
    notifications_list = (
        SELECT jsonb_agg(
            jsonb_build_object(
                'userId', user_id,
                'type', 'assignment_added',
                'title', 'Nouveau devoir',
                'body', format('Un nouveau devoir en %s a été ajouté pour la classe %s.', subject_record.name, class_record.name),
                'data', notification_data,
                'priority', 'normal',
                'channels', ARRAY['in_app', 'push']
            )
        )
        FROM (
            SELECT student_id AS user_id FROM UNNEST(student_ids) AS student_id
            UNION ALL
            SELECT parent_id AS user_id FROM UNNEST(parent_ids) AS parent_id
        ) recipients
    );

    -- Appeler l'Edge Function pour créer et envoyer les notifications
    IF notifications_list IS NOT NULL THEN
        PERFORM net.http_post(
            url := format('%s/functions/v1/send-notification', current_setting('app.supabase_url')),
            headers := jsonb_build_object(
                'Authorization', format('Bearer %s', current_setting('app.supabase_service_role_key')),
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'notifications', notifications_list,
                'schoolId', school_record.id
            ),
            timeout_milliseconds := 10000
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Logger l'erreur sans bloquer l'opération
        RAISE WARNING 'Erreur dans notify_lesson_assignment_added: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour les devoirs
DROP TRIGGER IF EXISTS notify_lesson_assignment_added_trigger ON lesson_logs;
CREATE TRIGGER notify_lesson_assignment_added_trigger
    AFTER INSERT OR UPDATE ON lesson_logs
    FOR EACH ROW
    EXECUTE FUNCTION notify_lesson_assignment_added();

-- =====================================================
-- Commentaires de documentation
-- =====================================================

COMMENT ON FUNCTION notify_grades_published() IS '
Déclenche des notifications aux élèves et parents quand des notes sont publiées.
Usage: Trigger automatique après UPDATE sur la table grades quand status passe à "published"
Destinataires: Tous les élèves de la classe + leurs parents
Canaux: in_app, push
Type de notification: grade_posted
Note: Le trigger construit les notifications et les passe à send-notification qui les crée et les envoie
';

COMMENT ON FUNCTION notify_lesson_assignment_added() IS '
Déclenche des notifications aux élèves et parents quand un devoir est ajouté.
Usage: Trigger automatique après INSERT ou UPDATE sur lesson_logs quand assignment_description est renseigné
Destinataires: Tous les élèves de la classe + leurs parents
Canaux: in_app, push
Type de notification: assignment_added
Note: Le trigger construit les notifications et les passe à send-notification qui les crée et les envoie
';
