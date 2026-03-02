-- Fix chat audit triggers to use the new audit_logs schema via log_audit_event()
-- Replaces direct INSERTs that use old resource_type columns

CREATE OR REPLACE FUNCTION log_chat_message_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- Get school_id from conversation
  SELECT school_id INTO v_school_id 
  FROM chat_conversations 
  WHERE id = NEW.conversation_id;

  -- Use standard audit logging function
  PERFORM log_audit_event(
    'chat_message', 
    NEW.id, 
    'create', 
    'chat_messages', 
    'Message sent in conversation ' || NEW.conversation_id, 
    v_school_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_chat_moderation_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Use standard audit logging function
  PERFORM log_audit_event(
    'chat_moderation', 
    NEW.id, 
    NEW.action, 
    'chat_moderation_logs', 
    'Chat moderation action: ' || NEW.action || ' for user ' || NEW.user_id, 
    NEW.school_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
