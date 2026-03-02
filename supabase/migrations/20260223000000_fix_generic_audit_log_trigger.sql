-- Migration: Fix create_audit_log function
-- Description: Updates the generic create_audit_log function used by school config tables to use the new log_audit_event function and avoid legacy columns.

CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_entity_id UUID;
  v_description TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    -- Try to get school_id, fallback to null if it doesn't exist on the table
    BEGIN
      v_school_id := OLD.school_id;
    EXCEPTION WHEN OTHERS THEN
      v_school_id := NULL;
    END;
    
    BEGIN
      v_entity_id := OLD.id;
    EXCEPTION WHEN OTHERS THEN
      v_entity_id := NULL;
    END;

    v_description := 'Deleted record from ' || TG_TABLE_NAME;
    
    PERFORM log_audit_event(
      TG_TABLE_NAME, 
      v_entity_id,
      'delete', 
      TG_TABLE_NAME,
      v_description,
      v_school_id
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    BEGIN
      v_school_id := NEW.school_id;
    EXCEPTION WHEN OTHERS THEN
      v_school_id := NULL;
    END;
    
    BEGIN
      v_entity_id := NEW.id;
    EXCEPTION WHEN OTHERS THEN
      v_entity_id := NULL;
    END;

    v_description := 'Updated record in ' || TG_TABLE_NAME;
    
    PERFORM log_audit_event(
      TG_TABLE_NAME,
      v_entity_id,
      'update',
      TG_TABLE_NAME,
      v_description,
      v_school_id
    );
    RETURN NEW;
  ELSE
    BEGIN
      v_school_id := NEW.school_id;
    EXCEPTION WHEN OTHERS THEN
      v_school_id := NULL;
    END;
    
    BEGIN
      v_entity_id := NEW.id;
    EXCEPTION WHEN OTHERS THEN
      v_entity_id := NULL;
    END;

    v_description := 'Created record in ' || TG_TABLE_NAME;
    
    PERFORM log_audit_event(
      TG_TABLE_NAME,
      v_entity_id,
      'create',
      TG_TABLE_NAME,
      v_description,
      v_school_id
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
