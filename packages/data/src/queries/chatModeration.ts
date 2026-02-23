import { getSupabaseClient } from '../client';
import type { ModerateMessage, BlockUser, CreateModerationRule } from '@novaconnect/core';

export async function moderateMessage(data: ModerateMessage) {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  // Récupérer message et conversation
  const { data: message } = await getSupabaseClient()
    .from('chat_messages')
    .select('conversation_id, sender_id, content')
    .eq('id', data.messageId)
    .single();

  if (!message) throw new Error('Message not found');

  const { data: conversation } = await getSupabaseClient()
    .from('chat_conversations')
    .select('school_id')
    .eq('id', message.conversation_id)
    .single();

  // Logger action de modération
  const { error: logError } = await getSupabaseClient()
    .from('chat_moderation_logs')
    .insert({
      school_id: conversation.school_id,
      conversation_id: message.conversation_id,
      message_id: data.messageId,
      user_id: message.sender_id,
      action: data.action,
      reason: data.reason,
      flagged_content: message.content.substring(0, 500),
      moderator_id: user.id,
      auto_moderated: false,
    });

  if (logError) throw logError;

  // Mettre à jour statut message
  if (data.action === 'rejected') {
    const { error: updateError } = await getSupabaseClient()
      .from('chat_messages')
      .update({
        status: 'moderated',
        is_moderated: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', data.messageId);

    if (updateError) throw updateError;
  } else if (data.action === 'approved') {
    const { error: updateError } = await getSupabaseClient()
      .from('chat_messages')
      .update({
        status: 'sent',
        is_moderated: true,
        moderation_required: false,
      })
      .eq('id', data.messageId);

    if (updateError) throw updateError;
  }

  return { success: true };
}

export async function blockUser(data: BlockUser) {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await getSupabaseClient()
    .from('chat_participants')
    .update({
      is_blocked: true,
      blocked_at: new Date().toISOString(),
      blocked_by: user.id,
      blocked_reason: data.reason,
    })
    .eq('conversation_id', data.conversationId)
    .eq('user_id', data.userId);

  if (error) throw error;

  // Logger action
  const { data: conversation } = await getSupabaseClient()
    .from('chat_conversations')
    .select('school_id')
    .eq('id', data.conversationId)
    .single();

  await getSupabaseClient()
    .from('chat_moderation_logs')
    .insert({
      school_id: conversation.school_id,
      conversation_id: data.conversationId,
      user_id: data.userId,
      action: 'user_blocked',
      reason: data.reason,
      moderator_id: user.id,
      auto_moderated: false,
    });

  return { success: true };
}

export async function unblockUser(conversationId: string, userId: string) {
  const { error } = await getSupabaseClient()
    .from('chat_participants')
    .update({
      is_blocked: false,
      blocked_at: null,
      blocked_by: null,
      blocked_reason: null,
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) throw error;

  // Logger action
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  const { data: conversation } = await getSupabaseClient()
    .from('chat_conversations')
    .select('school_id')
    .eq('id', conversationId)
    .single();

  await getSupabaseClient()
    .from('chat_moderation_logs')
    .insert({
      school_id: conversation.school_id,
      conversation_id: conversationId,
      user_id: userId,
      action: 'user_unblocked',
      moderator_id: user?.id,
      auto_moderated: false,
    });

  return { success: true };
}

export async function createModerationRule(data: CreateModerationRule) {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data: rule, error } = await getSupabaseClient()
    .from('chat_moderation_rules')
    .insert({
      ...data,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return rule;
}

export async function getModerationRules(schoolId: string) {
  const { data, error } = await getSupabaseClient()
    .from('chat_moderation_rules')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getModerationLogs(schoolId: string, filters?: {
  conversationId?: string;
  userId?: string;
  action?: string;
}) {
  let query = getSupabaseClient()
    .from('chat_moderation_logs')
    .select(`
      *,
      moderator:users!moderator_id(first_name, last_name),
      user:users!user_id(first_name, last_name)
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (filters?.conversationId) {
    query = query.eq('conversation_id', filters.conversationId);
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters?.action) {
    query = query.eq('action', filters.action);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
