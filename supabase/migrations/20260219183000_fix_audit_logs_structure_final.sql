-- ============================================
-- Migration: Fix audit_logs structure - FINAL SOLUTION
-- Created: 2026-02-19
-- Description: Synchronise la structure de audit_logs avec le schéma attendu par l'application
--              Ajoute entity_type, entity_id, table_name, description si manquants
--              ou migre depuis l'ancien schéma (resource_type, resource_id)
-- ============================================

-- ============================================
-- PARTIE 1: Vérifier et corriger la structure de audit_logs
-- ============================================

DO $$
DECLARE
  v_has_entity_type BOOLEAN;
  v_has_resource_type BOOLEAN;
  v_has_table_name BOOLEAN;
BEGIN
  -- Vérifier si la colonne entity_type existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'entity_type'
  ) INTO v_has_entity_type;

  -- Vérifier si la colonne resource_type existe (ancien schéma)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'resource_type'
  ) INTO v_has_resource_type;

  -- Vérifier si la colonne table_name existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'table_name'
  ) INTO v_has_table_name;

  -- Cas 1: Table a l'ancien schéma (resource_type) mais pas le nouveau (entity_type)
  IF v_has_resource_type AND NOT v_has_entity_type THEN
    RAISE NOTICE 'Migration de l ancien schéma audit_logs vers le nouveau schéma...';
    
    -- Renommer les colonnes existantes
    ALTER TABLE audit_logs RENAME COLUMN resource_type TO entity_type;
    ALTER TABLE audit_logs RENAME COLUMN resource_id TO entity_id;
    
    -- Ajouter table_name si manquant
    IF NOT v_has_table_name THEN
      ALTER TABLE audit_logs ADD COLUMN table_name TEXT;
      -- Mettre à jour les données existantes
      UPDATE audit_logs SET table_name = entity_type WHERE table_name IS NULL;
    END IF;
    
    -- Ajouter description si manquant
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'audit_logs' AND column_name = 'description'
    ) THEN
      ALTER TABLE audit_logs ADD COLUMN description TEXT;
    END IF;
    
    -- Modifier le type de action si c'est un enum
    ALTER TABLE audit_logs ALTER COLUMN action TYPE TEXT;
    
    -- Supprimer les colonnes obsolètes si elles existent
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS old_data;
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS new_data;
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS ip_address;
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_agent;
    ALTER TABLE audit_logs DROP COLUMN IF EXISTS metadata;
    
    RAISE NOTICE 'Migration terminée avec succès.';
    
  -- Cas 2: Table n'a ni l'ancien ni le nouveau schéma complet
  ELSIF NOT v_has_entity_type AND NOT v_has_resource_type THEN
    RAISE NOTICE 'Ajout des colonnes manquantes à audit_logs...';
    
    ALTER TABLE audit_logs ADD COLUMN entity_type TEXT;
    ALTER TABLE audit_logs ADD COLUMN entity_id UUID;
    ALTER TABLE audit_logs ADD COLUMN table_name TEXT;
    ALTER TABLE audit_logs ADD COLUMN description TEXT;
    
    RAISE NOTICE 'Colonnes ajoutées.';
  END IF;

  -- Cas 3: S'assurer que table_name existe même si entity_type existe
  IF v_has_entity_type AND NOT v_has_table_name THEN
    RAISE NOTICE 'Ajout de la colonne table_name...';
    ALTER TABLE audit_logs ADD COLUMN table_name TEXT;
    UPDATE audit_logs SET table_name = entity_type WHERE table_name IS NULL;
  END IF;

  -- S'assurer que description existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = 'description'
  ) THEN
    RAISE NOTICE 'Ajout de la colonne description...';
    ALTER TABLE audit_logs ADD COLUMN description TEXT;
  END IF;

END $$;

-- ============================================
-- PARTIE 2: Recréer les index si nécessaire
-- ============================================

DROP INDEX IF EXISTS idx_audit_logs_entity;
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

DROP INDEX IF EXISTS idx_audit_logs_school;
CREATE INDEX idx_audit_logs_school ON audit_logs(school_id);

-- Supprimer l'ancien index resource_type s'il existe
DROP INDEX IF EXISTS idx_audit_logs_resource_type;
DROP INDEX IF EXISTS idx_audit_logs_resource_id;

-- ============================================
-- PARTIE 3: Mettre à jour la fonction log_audit_event
-- ============================================

DROP FUNCTION IF EXISTS log_audit_event(TEXT, UUID, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION log_audit_event(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_table_name TEXT,
  p_description TEXT,
  p_school_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  INSERT INTO audit_logs (
    entity_type,
    entity_id,
    action,
    table_name,
    description,
    school_id,
    user_id
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_action,
    p_table_name,
    p_description,
    p_school_id,
    v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PARTIE 4: Mettre à jour la fonction publish_schedule_bypass_rls
-- ============================================

DROP FUNCTION IF EXISTS publish_schedule_bypass_rls(UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION publish_schedule_bypass_rls(
  p_schedule_id UUID,
  p_user_id UUID,
  p_notify_users BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_academic_year RECORD;
  v_new_version INTEGER;
  v_slots JSONB;
  v_updated_schedule RECORD;
BEGIN
  -- Get schedule data with academic year
  SELECT s.*, ay.start_date, ay.end_date
  INTO v_schedule
  FROM schedules s
  JOIN academic_years ay ON ay.id = s.academic_year_id
  WHERE s.id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Schedule not found'
    );
  END IF;

  -- Calculate new version
  SELECT GREATEST(
    COALESCE(v_schedule.version, 0),
    COALESCE((SELECT MAX(version) FROM schedule_versions WHERE schedule_id = p_schedule_id), 0)
  ) + 1
  INTO v_new_version;

  -- Get slots for snapshot
  SELECT jsonb_agg(to_jsonb(ss.*))
  INTO v_slots
  FROM schedule_slots ss
  WHERE ss.schedule_id = p_schedule_id;

  -- Create version snapshot
  INSERT INTO schedule_versions (
    schedule_id,
    school_id,
    version,
    snapshot_data,
    change_summary,
    created_by
  ) VALUES (
    p_schedule_id,
    v_schedule.school_id,
    v_new_version,
    COALESCE(v_slots, '[]'::jsonb),
    'Published version ' || v_new_version,
    p_user_id
  )
  ON CONFLICT (schedule_id, version) DO UPDATE SET
    snapshot_data = EXCLUDED.snapshot_data,
    change_summary = EXCLUDED.change_summary,
    created_at = NOW();

  -- Update schedule
  UPDATE schedules
  SET 
    status = 'published',
    version = v_new_version,
    published_at = NOW(),
    published_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_schedule_id
  RETURNING * INTO v_updated_schedule;

  -- Audit log avec le schéma corrigé
  INSERT INTO audit_logs (
    school_id,
    user_id,
    entity_type,
    entity_id,
    action,
    table_name,
    description
  ) VALUES (
    v_schedule.school_id,
    p_user_id,
    'schedule',
    p_schedule_id,
    'publish',
    'schedules',
    'Published schedule: ' || v_schedule.name || ' (version ' || v_new_version || ')'
  );

  RETURN jsonb_build_object(
    'success', true,
    'schedule', to_jsonb(v_updated_schedule),
    'version', v_new_version,
    'school_id', v_schedule.school_id,
    'academic_year_id', v_schedule.academic_year_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION publish_schedule_bypass_rls(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_schedule_bypass_rls(UUID, UUID, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION publish_schedule_bypass_rls(UUID, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, UUID, TEXT, TEXT, TEXT, UUID) TO service_role;

-- Comments
COMMENT ON FUNCTION publish_schedule_bypass_rls IS 'Publishes a schedule and creates a version snapshot. Uses SECURITY DEFINER to bypass RLS policies.';
COMMENT ON FUNCTION log_audit_event IS 'Logs audit events with entity_type/entity_id schema';

-- ============================================
-- PARTIE 5: Recréer les triggers d'audit si nécessaire
-- ============================================

-- Trigger pour card_templates
DROP TRIGGER IF EXISTS card_templates_audit_trigger ON card_templates;
DROP FUNCTION IF EXISTS audit_card_templates();

CREATE OR REPLACE FUNCTION audit_card_templates()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'card_template', NEW.id, 'create', 'card_templates', 
      'Created: ' || COALESCE(NEW.name, 'Unnamed'), NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'card_template', NEW.id, 'update', 'card_templates', 
      'Updated: ' || COALESCE(NEW.name, 'Unnamed'), NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'card_template', OLD.id, 'delete', 'card_templates', 
      'Deleted: ' || COALESCE(OLD.name, 'Unnamed'), OLD.school_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER card_templates_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON card_templates
  FOR EACH ROW EXECUTE FUNCTION audit_card_templates();

-- Trigger pour student_cards
DROP TRIGGER IF EXISTS student_cards_audit_trigger ON student_cards;
DROP FUNCTION IF EXISTS audit_student_cards();

CREATE OR REPLACE FUNCTION audit_student_cards()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'student_card', NEW.id, 'create', 'student_cards', 
      'Card created for: ' || NEW.student_id, NEW.school_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM log_audit_event(
        'student_card', NEW.id, 'update', 'student_cards', 
        'Status: ' || OLD.status || ' → ' || NEW.status, NEW.school_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'student_card', OLD.id, 'delete', 'student_cards', 
      'Card deleted', OLD.school_id);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_cards_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON student_cards
  FOR EACH ROW EXECUTE FUNCTION audit_student_cards();

-- ============================================
-- PARTIE 6: Vérification finale
-- ============================================

DO $$
DECLARE
  v_missing_columns TEXT[];
BEGIN
  SELECT array_agg(column_name)
  INTO v_missing_columns
  FROM (
    SELECT 'entity_type' AS column_name
    UNION SELECT 'entity_id'
    UNION SELECT 'action'
    UNION SELECT 'table_name'
    UNION SELECT 'description'
  ) required
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_logs' AND column_name = required.column_name
  );

  IF v_missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Colonnes manquantes dans audit_logs: %', v_missing_columns;
  ELSE
    RAISE NOTICE '✅ Structure de audit_logs vérifiée avec succès. Toutes les colonnes sont présentes.';
  END IF;
END $$;
