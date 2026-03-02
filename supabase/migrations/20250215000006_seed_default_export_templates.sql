-- ============================================
-- Module Premium - API Export Avancé
-- Migration: Seed Default Export Templates
-- ============================================

-- ============================================
-- Function to seed default templates for a school
-- ============================================
CREATE OR REPLACE FUNCTION seed_default_export_templates_for_school(target_school_id UUID)
RETURNS void AS $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get the first admin user for this school
    SELECT user_id INTO admin_user_id
    FROM school_admins
    WHERE school_id = target_school_id
    LIMIT 1;

    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'No admin user found for school %, skipping template seeding', target_school_id;
        RETURN;
    END IF;

    -- Template 1: Bulletins Complets (Excel)
    INSERT INTO export_templates (
        school_id,
        name,
        description,
        export_type,
        resource_type,
        template_config,
        is_active,
        created_by
    ) VALUES (
        target_school_id,
        'Bulletins Complets',
        'Export complet des bulletins avec moyennes, rangs et mentions',
        'excel',
        'bulletins',
        jsonb_build_object(
            'columns', jsonb_build_array(
                jsonb_build_object('key', 'student_id', 'header', 'Matricule', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'student_name', 'header', 'Élève', 'width', 25, 'visible', true),
                jsonb_build_object('key', 'class_name', 'header', 'Classe', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'period_name', 'header', 'Période', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'average', 'header', 'Moyenne', 'width', 12, 'visible', true, 'format', 'number', 'decimals', 2),
                jsonb_build_object('key', 'rank', 'header', 'Rang', 'width', 10, 'visible', true, 'format', 'integer'),
                jsonb_build_object('key', 'mention', 'header', 'Mention', 'width', 20, 'visible', true),
                jsonb_build_object('key', 'appreciation', 'header', 'Appréciation', 'width', 30, 'visible', true)
            ),
            'filters', jsonb_build_object(
                'period_id', true,
                'class_id', true,
                'dateRange', true
            ),
            'styles', jsonb_build_object(
                'headerColor', '#2E7D32',
                'headerFont', 'Arial',
                'headerFontSize', 12,
                'headerBold', true,
                'alternateRows', true,
                'alternateRowColor', '#F1F8E9',
                'logo', true
            ),
            'sortBy', jsonb_build_object('column', 'student_name', 'direction', 'asc')
        ),
        true,
        admin_user_id
    ) ON CONFLICT DO NOTHING;

    -- Template 2: Bulletins par Classe (PDF)
    INSERT INTO export_templates (
        school_id,
        name,
        description,
        export_type,
        resource_type,
        template_config,
        is_active,
        created_by
    ) VALUES (
        target_school_id,
        'Bulletins par Classe (PDF)',
        'Bulletins individuels formatés pour impression, un par page',
        'pdf',
        'bulletins',
        jsonb_build_object(
            'columns', jsonb_build_array(
                jsonb_build_object('key', 'student_id', 'header', 'Matricule', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'student_name', 'header', 'Élève', 'width', 25, 'visible', true),
                jsonb_build_object('key', 'class_name', 'header', 'Classe', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'period_name', 'header', 'Période', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'average', 'header', 'Moyenne', 'width', 12, 'visible', true),
                jsonb_build_object('key', 'rank', 'header', 'Rang', 'width', 10, 'visible', true),
                jsonb_build_object('key', 'mention', 'header', 'Mention', 'width', 20, 'visible', true),
                jsonb_build_object('key', 'subjects', 'header', 'Notes par matière', 'width', 30, 'visible', true)
            ),
            'filters', jsonb_build_object(
                'period_id', true,
                'class_id', true
            ),
            'styles', jsonb_build_object(
                'pageSize', 'A4',
                'orientation', 'portrait',
                'logo', true,
                'schoolHeader', true,
                'footer', true,
                'signatureLines', true
            ),
            'sortBy', jsonb_build_object('column', 'student_name', 'direction', 'asc')
        ),
        true,
        admin_user_id
    ) ON CONFLICT DO NOTHING;

    -- Template 3: Liste Élèves (CSV)
    INSERT INTO export_templates (
        school_id,
        name,
        description,
        export_type,
        resource_type,
        template_config,
        is_active,
        created_by
    ) VALUES (
        target_school_id,
        'Liste Élèves',
        'Export simple de la liste des élèves au format CSV',
        'csv',
        'students',
        jsonb_build_object(
            'columns', jsonb_build_array(
                jsonb_build_object('key', 'id', 'header', 'Matricule', 'visible', true),
                jsonb_build_object('key', 'last_name', 'header', 'Nom', 'visible', true),
                jsonb_build_object('key', 'first_name', 'header', 'Prénom', 'visible', true),
                jsonb_build_object('key', 'date_of_birth', 'header', 'Date de naissance', 'visible', true, 'format', 'date'),
                jsonb_build_object('key', 'gender', 'header', 'Sexe', 'visible', true),
                jsonb_build_object('key', 'class_name', 'header', 'Classe', 'visible', true),
                jsonb_build_object('key', 'enrollment_status', 'header', 'Statut', 'visible', true),
                jsonb_build_object('key', 'enrollment_date', 'header', 'Date inscription', 'visible', true, 'format', 'date')
            ),
            'filters', jsonb_build_object(
                'class_id', true,
                'status', true,
                'dateRange', true
            ),
            'styles', jsonb_build_object(
                'separator', ',',
                'encoding', 'UTF-8',
                'includeBOM', true
            ),
            'sortBy', jsonb_build_object('column', 'last_name', 'direction', 'asc')
        ),
        true,
        admin_user_id
    ) ON CONFLICT DO NOTHING;

    -- Template 4: Présences Mensuelles (Excel)
    INSERT INTO export_templates (
        school_id,
        name,
        description,
        export_type,
        resource_type,
        template_config,
        is_active,
        created_by
    ) VALUES (
        target_school_id,
        'Présences Mensuelles',
        'Récapitulatif des présences par mois avec statistiques',
        'excel',
        'attendance',
        jsonb_build_object(
            'columns', jsonb_build_array(
                jsonb_build_object('key', 'student_id', 'header', 'Matricule', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'student_name', 'header', 'Élève', 'width', 25, 'visible', true),
                jsonb_build_object('key', 'class_name', 'header', 'Classe', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'month', 'header', 'Mois', 'width', 12, 'visible', true),
                jsonb_build_object('key', 'present_days', 'header', 'Jours Présent', 'width', 15, 'visible', true, 'format', 'integer'),
                jsonb_build_object('key', 'absent_days', 'header', 'Jours Absent', 'width', 15, 'visible', true, 'format', 'integer'),
                jsonb_build_object('key', 'late_days', 'header', 'Retards', 'width', 12, 'visible', true, 'format', 'integer'),
                jsonb_build_object('key', 'excused_absences', 'header', 'Absences Justifiées', 'width', 18, 'visible', true, 'format', 'integer'),
                jsonb_build_object('key', 'attendance_rate', 'header', 'Taux de présence', 'width', 18, 'visible', true, 'format', 'percentage')
            ),
            'filters', jsonb_build_object(
                'month', true,
                'class_id', true,
                'year', true
            ),
            'styles', jsonb_build_object(
                'headerColor', '#1565C0',
                'headerFont', 'Arial',
                'headerFontSize', 11,
                'headerBold', true,
                'alternateRows', true,
                'alternateRowColor', '#E3F2FD',
                'logo', true
            ),
            'sortBy', jsonb_build_object('column', 'student_name', 'direction', 'asc')
        ),
        true,
        admin_user_id
    ) ON CONFLICT DO NOTHING;

    -- Template 5: Paiements (Excel)
    INSERT INTO export_templates (
        school_id,
        name,
        description,
        export_type,
        resource_type,
        template_config,
        is_active,
        created_by
    ) VALUES (
        target_school_id,
        'Paiements',
        'Historique des paiements avec détails et soldes',
        'excel',
        'payments',
        jsonb_build_object(
            'columns', jsonb_build_array(
                jsonb_build_object('key', 'payment_id', 'header', 'N° Paiement', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'payment_date', 'header', 'Date', 'width', 15, 'visible', true, 'format', 'date'),
                jsonb_build_object('key', 'student_name', 'header', 'Élève', 'width', 25, 'visible', true),
                jsonb_build_object('key', 'class_name', 'header', 'Classe', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'fee_type', 'header', 'Type de frais', 'width', 20, 'visible', true),
                jsonb_build_object('key', 'amount', 'header', 'Montant', 'width', 15, 'visible', true, 'format', 'currency', 'symbol', 'FCFA'),
                jsonb_build_object('key', 'payment_method', 'header', 'Mode de paiement', 'width', 18, 'visible', true),
                jsonb_build_object('key', 'reference', 'header', 'Référence', 'width', 20, 'visible', true),
                jsonb_build_object('key', 'status', 'header', 'Statut', 'width', 12, 'visible', true)
            ),
            'filters', jsonb_build_object(
                'dateRange', true,
                'class_id', true,
                'status', true,
                'feeType', true
            ),
            'styles', jsonb_build_object(
                'headerColor', '#2E7D32',
                'headerFont', 'Arial',
                'headerFontSize', 11,
                'headerBold', true,
                'alternateRows', true,
                'alternateRowColor', '#F1F8E9',
                'logo', true
            ),
            'sortBy', jsonb_build_object('column', 'payment_date', 'direction', 'desc')
        ),
        true,
        admin_user_id
    ) ON CONFLICT DO NOTHING;

    -- Template 6: Salaires (Excel)
    INSERT INTO export_templates (
        school_id,
        name,
        description,
        export_type,
        resource_type,
        template_config,
        is_active,
        created_by
    ) VALUES (
        target_school_id,
        'Salaires',
        'Liste des salaires avec détails des composants',
        'excel',
        'payroll',
        jsonb_build_object(
            'columns', jsonb_build_array(
                jsonb_build_object('key', 'teacher_id', 'header', 'ID Enseignant', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'teacher_name', 'header', 'Enseignant', 'width', 25, 'visible', true),
                jsonb_build_object('key', 'period', 'header', 'Période', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'base_salary', 'header', 'Salaire de base', 'width', 18, 'visible', true, 'format', 'currency', 'symbol', 'FCFA'),
                jsonb_build_object('key', 'hours_worked', 'header', 'Heures travaillées', 'width', 18, 'visible', true, 'format', 'number', 'decimals', 2),
                jsonb_build_object('key', 'hourly_rate', 'header', 'Taux horaire', 'width', 15, 'visible', true, 'format', 'currency', 'symbol', 'FCFA'),
                jsonb_build_object('key', 'gross_salary', 'header', 'Salaire brut', 'width', 18, 'visible', true, 'format', 'currency', 'symbol', 'FCFA'),
                jsonb_build_object('key', 'deductions', 'header', 'Déductions', 'width', 15, 'visible', true, 'format', 'currency', 'symbol', 'FCFA'),
                jsonb_build_object('key', 'net_salary', 'header', 'Salaire net', 'width', 18, 'visible', true, 'format', 'currency', 'symbol', 'FCFA'),
                jsonb_build_object('key', 'status', 'header', 'Statut', 'width', 12, 'visible', true)
            ),
            'filters', jsonb_build_object(
                'period', true,
                'teacher_id', true,
                'status', true
            ),
            'styles', jsonb_build_object(
                'headerColor', '#6A1B9A',
                'headerFont', 'Arial',
                'headerFontSize', 11,
                'headerBold', true,
                'alternateRows', true,
                'alternateRowColor', '#F3E5F5',
                'logo', true
            ),
            'sortBy', jsonb_build_object('column', 'teacher_name', 'direction', 'asc')
        ),
        true,
        admin_user_id
    ) ON CONFLICT DO NOTHING;

    -- Template 7: Notes par Matière (Excel)
    INSERT INTO export_templates (
        school_id,
        name,
        description,
        export_type,
        resource_type,
        template_config,
        is_active,
        created_by
    ) VALUES (
        target_school_id,
        'Notes par Matière',
        'Notes des élèves détaillées par matière',
        'excel',
        'grades',
        jsonb_build_object(
            'columns', jsonb_build_array(
                jsonb_build_object('key', 'student_id', 'header', 'Matricule', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'student_name', 'header', 'Élève', 'width', 25, 'visible', true),
                jsonb_build_object('key', 'class_name', 'header', 'Classe', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'subject_name', 'header', 'Matière', 'width', 20, 'visible', true),
                jsonb_build_object('key', 'grade_type', 'header', 'Type de note', 'width', 15, 'visible', true),
                jsonb_build_object('key', 'score', 'header', 'Note', 'width', 12, 'visible', true, 'format', 'number', 'decimals', 2),
                jsonb_build_object('key', 'max_score', 'header', 'Barème', 'width', 12, 'visible', true, 'format', 'number', 'decimals', 2),
                jsonb_build_object('key', 'coefficient', 'header', 'Coefficient', 'width', 12, 'visible', true, 'format', 'number', 'decimals', 1),
                jsonb_build_object('key', 'graded_date', 'header', 'Date notation', 'width', 15, 'visible', true, 'format', 'date')
            ),
            'filters', jsonb_build_object(
                'period_id', true,
                'class_id', true,
                'subject_id', true,
                'gradeType', true
            ),
            'styles', jsonb_build_object(
                'headerColor', '#EF6C00',
                'headerFont', 'Arial',
                'headerFontSize', 11,
                'headerBold', true,
                'alternateRows', true,
                'alternateRowColor', '#FFF3E0',
                'logo', true
            ),
            'sortBy', jsonb_build_object('column', 'student_name', 'direction', 'asc')
        ),
        true,
        admin_user_id
    ) ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Default export templates seeded for school %', target_school_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Seed templates for all existing schools
-- ============================================
DO $$
DECLARE
    school_record RECORD;
BEGIN
    -- Loop through all existing schools
    FOR school_record IN
        SELECT id FROM schools
    LOOP
        PERFORM seed_default_export_templates_for_school(school_record.id);
    END LOOP;
END $$;

-- ============================================
-- Comments
-- ============================================

COMMENT ON FUNCTION seed_default_export_templates_for_school IS 'Seed default export templates for a specific school';

-- ============================================
-- Usage Instructions
-- ============================================
/*

To seed default templates for a new school:

SELECT seed_default_export_templates_for_school('<school_id>');

To manually add templates for all schools:

DO $$
DECLARE
    school_record RECORD;
BEGIN
    FOR school_record IN SELECT id FROM schools LOOP
        PERFORM seed_default_export_templates_for_school(school_record.id);
    END LOOP;
END $$;

Default templates created:
1. Bulletins Complets (Excel) - Complete report cards with averages and ranks
2. Bulletins par Classe (PDF) - Individual PDF report cards for printing
3. Liste Élèves (CSV) - Simple student list export
4. Présences Mensuelles (Excel) - Monthly attendance summary
5. Paiements (Excel) - Payment history
6. Salaires (Excel) - Payroll details
7. Notes par Matière (Excel) - Grades by subject

Each template includes:
- Pre-configured columns with appropriate headers and widths
- Common filters for the resource type
- Styling options (colors, fonts, alternate rows)
- Sorting configuration
- School logo (where applicable)
*/
