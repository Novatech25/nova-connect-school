-- Migration: Room Assignment Recalculation Triggers
-- Created: 2025-03-01
-- Description: Triggers for automatic recalculation when schedule changes

-- Trigger function for recalculating room assignments when schedule slots change
CREATE OR REPLACE FUNCTION trigger_room_assignment_recalculation()
RETURNS TRIGGER AS $$
DECLARE
  v_config JSONB;
  v_auto_recalculate BOOLEAN;
BEGIN
  -- Get school configuration
  SELECT settings->'dynamicRoomAssignment' INTO v_config
  FROM schools
  WHERE id = NEW.school_id;

  -- Check if module is enabled and autoRecalculateOnChange is true
  v_auto_recalculate := COALESCE((v_config->>'enabled')::BOOLEAN, false)
    AND COALESCE((v_config->>'autoRecalculateOnChange')::BOOLEAN, true);

  IF v_auto_recalculate THEN
    -- Mark existing assignments as 'updated' (needs recalculation)
    UPDATE room_assignments
    SET status = 'updated',
        version = version + 1,
        updated_at = NOW()
    WHERE school_id = NEW.school_id
      AND schedule_slot_id = NEW.id
      AND status = 'published';

    -- Log the event
    INSERT INTO room_assignment_events (
      school_id,
      room_assignment_id,
      event_type,
      reason,
      metadata
    )
    SELECT
      school_id,
      id,
      'updated',
      'Schedule slot modified - recalculation needed',
      jsonb_build_object(
        'slot_id', NEW.id,
        'old_start_time', OLD.start_time,
        'new_start_time', NEW.start_time,
        'old_end_time', OLD.end_time,
        'new_end_time', NEW.end_time,
        'old_teacher_id', OLD.teacher_id,
        'new_teacher_id', NEW.teacher_id,
        'old_class_id', OLD.class_id,
        'new_class_id', NEW.class_id
      )
    FROM room_assignments
    WHERE school_id = NEW.school_id
      AND schedule_slot_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on schedule_slots UPDATE
DROP TRIGGER IF EXISTS schedule_slot_updated_recalculate_rooms ON schedule_slots;
CREATE TRIGGER schedule_slot_updated_recalculate_rooms
AFTER UPDATE ON schedule_slots
FOR EACH ROW
WHEN (
  OLD.start_time IS DISTINCT FROM NEW.start_time OR
  OLD.end_time IS DISTINCT FROM NEW.end_time OR
  OLD.teacher_id IS DISTINCT FROM NEW.teacher_id OR
  OLD.class_id IS DISTINCT FROM NEW.class_id OR
  OLD.campus_id IS DISTINCT FROM NEW.campus_id OR
  OLD.day_of_week IS DISTINCT FROM NEW.day_of_week
)
EXECUTE FUNCTION trigger_room_assignment_recalculation();

-- Create trigger on schedule_slots DELETE
CREATE OR REPLACE FUNCTION trigger_room_assignment_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_config JSONB;
  v_auto_recalculate BOOLEAN;
BEGIN
  -- Get school configuration
  SELECT settings->'dynamicRoomAssignment' INTO v_config
  FROM schools
  WHERE id = OLD.school_id;

  -- Check if module is enabled
  v_auto_recalculate := COALESCE((v_config->>'enabled')::BOOLEAN, false);

  IF v_auto_recalculate THEN
    -- Cancel or mark for recalculation related assignments
    UPDATE room_assignments
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE school_id = OLD.school_id
      AND schedule_slot_id = OLD.id
      AND status = 'published';

    -- Log the event
    INSERT INTO room_assignment_events (
      school_id,
      room_assignment_id,
      event_type,
      reason,
      metadata
    )
    SELECT
      school_id,
      id,
      'cancelled',
      'Schedule slot deleted',
      jsonb_build_object('slot_id', OLD.id)
    FROM room_assignments
    WHERE school_id = OLD.school_id
      AND schedule_slot_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_slot_deleted_cancel_room_assignments ON schedule_slots;
CREATE TRIGGER schedule_slot_deleted_cancel_room_assignments
AFTER DELETE ON schedule_slots
FOR EACH ROW
EXECUTE FUNCTION trigger_room_assignment_deletion();

-- Add helpful comments
COMMENT ON FUNCTION trigger_room_assignment_recalculation() IS 'Automatically marks room assignments for recalculation when schedule slots change';
COMMENT ON FUNCTION trigger_room_assignment_deletion() IS 'Cancels room assignments when schedule slots are deleted';
