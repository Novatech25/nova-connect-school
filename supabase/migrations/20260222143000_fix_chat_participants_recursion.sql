-- Fix infinite recursion in chat_participants by using a security definer function

-- Create a helper function to get conversations for the current user safely
CREATE OR REPLACE FUNCTION get_user_chat_conversations()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT conversation_id FROM chat_participants WHERE user_id = auth.uid();
$$;

-- Drop problematic policies
DROP POLICY IF EXISTS "Participants can view their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON chat_participants;

-- Recreate chat_conversations SELECT policy
CREATE POLICY "Participants can view their conversations"
  ON chat_conversations FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND (
      id IN (SELECT get_user_chat_conversations())
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
        AND ur.school_id = chat_conversations.school_id
      )
    )
  );

-- Recreate chat_participants SELECT policy
CREATE POLICY "Users can view participants in their conversations"
  ON chat_participants FOR SELECT
  USING (
    conversation_id IN (SELECT get_user_chat_conversations())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN chat_conversations cc ON cc.school_id = ur.school_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND cc.id = chat_participants.conversation_id
    )
  );

-- Also update chat_messages SELECT policy which queried chat_participants directly
DROP POLICY IF EXISTS "Participants can view messages in their conversations" ON chat_messages;
CREATE POLICY "Participants can view messages in their conversations"
  ON chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM chat_participants
      WHERE user_id = auth.uid() AND is_blocked = false
    )
    AND (
      -- Sender can always see their own messages
      sender_id = auth.uid()
      -- Non-senders cannot see pending messages
      OR status != 'pending'
      -- Admins can see all messages including pending
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        JOIN chat_conversations cc ON cc.id = chat_messages.conversation_id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
        AND ur.school_id = cc.school_id
      )
    )
  );
