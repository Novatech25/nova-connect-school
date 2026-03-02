-- Enable RLS on all chat tables

-- chat_conversations
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- SELECT: participants can view their conversations
CREATE POLICY "Participants can view their conversations"
  ON chat_conversations FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND (
      id IN (SELECT conversation_id FROM chat_participants WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.name IN ('school_admin', 'supervisor')
        AND ur.school_id = chat_conversations.school_id
      )
    )
  );

-- INSERT: teachers and admins can create conversations
CREATE POLICY "Teachers and admins can create conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (
    school_id IN (SELECT school_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('teacher', 'school_admin', 'supervisor')
      AND ur.school_id = chat_conversations.school_id
    )
  );

-- UPDATE: admins only
CREATE POLICY "Admins can update conversations"
  ON chat_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = chat_conversations.school_id
    )
  );

-- chat_participants
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants in their conversations"
  ON chat_participants FOR SELECT
  USING (
    conversation_id IN (SELECT conversation_id FROM chat_participants WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN chat_conversations cc ON cc.school_id = ur.school_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND cc.id = chat_participants.conversation_id
    )
  );

CREATE POLICY "Conversation creators can add participants"
  ON chat_participants FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN chat_conversations cc ON cc.school_id = ur.school_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND cc.id = chat_participants.conversation_id
    )
  );

CREATE POLICY "Admins can update participants (block/unblock)"
  ON chat_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN chat_conversations cc ON cc.school_id = ur.school_id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND cc.id = chat_participants.conversation_id
    )
  );

-- chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Participants can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM chat_participants
      WHERE user_id = auth.uid() AND is_blocked = false
    )
  );

CREATE POLICY "Senders can update their own messages (edit)"
  ON chat_messages FOR UPDATE
  USING (sender_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Senders can soft-delete their messages"
  ON chat_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND deleted_at IS NOT NULL);

-- chat_attachments
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their conversations"
  ON chat_attachments FOR SELECT
  USING (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_participants cp ON cp.conversation_id = cm.conversation_id
      WHERE cp.user_id = auth.uid() AND cp.is_blocked = false
    )
  );

CREATE POLICY "Message senders can add attachments"
  ON chat_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND message_id IN (SELECT id FROM chat_messages WHERE sender_id = auth.uid())
  );

-- chat_moderation_logs
ALTER TABLE chat_moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation logs"
  ON chat_moderation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = chat_moderation_logs.school_id
    )
  );

CREATE POLICY "Service role can insert moderation logs"
  ON chat_moderation_logs FOR INSERT
  WITH CHECK (false); -- service_role bypasses RLS anyway

CREATE POLICY "Admins can insert moderation logs"
  ON chat_moderation_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = chat_moderation_logs.school_id
    )
  );

-- chat_moderation_rules
ALTER TABLE chat_moderation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage moderation rules"
  ON chat_moderation_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('school_admin', 'supervisor')
      AND ur.school_id = chat_moderation_rules.school_id
    )
  );
