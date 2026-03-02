-- Trigger audit log for messages
CREATE OR REPLACE FUNCTION log_chat_message_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action, resource_type, resource_id, user_id, school_id, details
  )
  SELECT
    'INSERT',
    'chat_messages',
    NEW.id,
    NEW.sender_id,
    cc.school_id,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'content_length', length(NEW.content),
      'has_attachments', EXISTS(SELECT 1 FROM chat_attachments WHERE message_id = NEW.id),
      'moderation_required', NEW.moderation_required
    )
  FROM chat_conversations cc
  WHERE cc.id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_chat_message_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION log_chat_message_creation();

-- Trigger audit log for moderation
CREATE OR REPLACE FUNCTION log_chat_moderation_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action, resource_type, resource_id, user_id, school_id, details
  )
  VALUES (
    'VALIDATE',
    'chat_moderation',
    NEW.id,
    NEW.moderator_id,
    NEW.school_id,
    jsonb_build_object(
      'action', NEW.action,
      'reason', NEW.reason,
      'auto_moderated', NEW.auto_moderated,
      'user_affected', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_chat_moderation_insert
  AFTER INSERT ON chat_moderation_logs
  FOR EACH ROW
  EXECUTE FUNCTION log_chat_moderation_action();

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE chat_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count(
  p_user_id UUID,
  p_conversation_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_last_read_at TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  SELECT last_read_at INTO v_last_read_at
  FROM chat_participants
  WHERE user_id = p_user_id AND conversation_id = p_conversation_id;

  SELECT COUNT(*) INTO v_count
  FROM chat_messages
  WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND sent_at > COALESCE(v_last_read_at, '1970-01-01'::TIMESTAMPTZ)
    AND deleted_at IS NULL;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
