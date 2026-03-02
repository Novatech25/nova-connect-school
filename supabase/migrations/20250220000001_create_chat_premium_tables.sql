-- Enums
CREATE TYPE chat_conversation_type_enum AS ENUM ('one_to_one', 'class_group');
CREATE TYPE chat_message_status_enum AS ENUM ('pending', 'sent', 'delivered', 'read', 'deleted', 'moderated');
CREATE TYPE chat_moderation_action_enum AS ENUM ('flagged', 'approved', 'rejected', 'user_blocked', 'user_unblocked');
CREATE TYPE chat_attachment_type_enum AS ENUM ('image', 'document', 'pdf', 'video', 'audio');

-- Table: chat_conversations
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  conversation_type chat_conversation_type_enum NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: chat_participants
CREATE TABLE chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT, -- 'teacher', 'parent', 'school_admin'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false,
  blocked_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  blocked_reason TEXT,
  UNIQUE(conversation_id, user_id)
);

-- Table: chat_messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status chat_message_status_enum DEFAULT 'sent',
  is_moderated BOOLEAN DEFAULT false,
  moderation_required BOOLEAN DEFAULT false,
  parent_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: chat_attachments
CREATE TABLE chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type chat_attachment_type_enum NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Table: chat_moderation_logs
CREATE TABLE chat_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action chat_moderation_action_enum NOT NULL,
  reason TEXT,
  flagged_content TEXT,
  moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  auto_moderated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: chat_moderation_rules
CREATE TABLE chat_moderation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL, -- 'forbidden_word', 'regex_pattern', 'max_message_length'
  rule_value TEXT NOT NULL,
  action TEXT NOT NULL, -- 'flag', 'block', 'require_approval'
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_conversations_school_id ON chat_conversations(school_id);
CREATE INDEX idx_chat_conversations_class_id ON chat_conversations(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX idx_chat_participants_conversation_id ON chat_participants(conversation_id);
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_sent_at ON chat_messages(sent_at DESC);
CREATE INDEX idx_chat_messages_moderation ON chat_messages(conversation_id, moderation_required) WHERE moderation_required = true;
CREATE INDEX idx_chat_attachments_message_id ON chat_attachments(message_id);
CREATE INDEX idx_chat_moderation_logs_school_id ON chat_moderation_logs(school_id);
CREATE INDEX idx_chat_moderation_logs_message_id ON chat_moderation_logs(message_id);
CREATE INDEX idx_chat_moderation_rules_school_id ON chat_moderation_rules(school_id) WHERE is_active = true;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;
