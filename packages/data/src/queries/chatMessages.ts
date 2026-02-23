import { getSupabaseClient } from '../client';
import type { SendMessage } from '@novaconnect/core';

export async function sendMessage(data: SendMessage) {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  // Valider message via Edge Function
  const { data: validation, error: validationError } = await getSupabaseClient().functions.invoke(
    'validate-chat-message',
    {
      body: {
        conversationId: data.conversationId,
        content: data.content,
        senderId: user.id,
      },
    }
  );

  if (validationError) throw validationError;
  if (!validation.valid) throw new Error('Message validation failed');

  // Insérer message
  const { data: message, error } = await getSupabaseClient()
    .from('chat_messages')
    .insert({
      conversation_id: data.conversationId,
      sender_id: user.id,
      content: data.content,
      parent_message_id: data.parentMessageId,
      moderation_required: validation.moderationRequired || false,
      status: validation.moderationRequired ? 'pending' : 'sent',
    })
    .select()
    .single();

  if (error) throw error;

  // Envoyer notification si pas de modération requise
  if (!validation.moderationRequired) {
    await getSupabaseClient().functions.invoke('send-chat-notification', {
      body: {
        messageId: message.id,
        conversationId: data.conversationId,
        senderId: user.id,
      },
    });
  }

  return message;
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50,
  offset = 0
) {
  const { data, error } = await getSupabaseClient()
    .from('chat_messages')
    .select(`
      *,
      sender:users(id, first_name, last_name, avatar_url),
      attachments:chat_attachments(*)
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}

export async function editMessage(messageId: string, newContent: string) {
  const { data, error } = await getSupabaseClient()
    .from('chat_messages')
    .update({
      content: newContent,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMessage(messageId: string) {
  const { data, error } = await getSupabaseClient()
    .from('chat_messages')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'deleted',
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markMessagesAsRead(conversationId: string) {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await getSupabaseClient().rpc('mark_messages_as_read', {
    p_conversation_id: conversationId,
    p_user_id: user.id,
  });

  if (error) throw error;
}

export async function clearConversation(conversationId: string) {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  // We soft "clear" by removing the user from the participants list
  // or marking a 'cleared_at' timestamp if it existed.
  // Since 'cleared_at' isn't explicitly in the schema, we'll delete the participant link
  // The trigger might re-add them if they receive a new message.
  const { error } = await getSupabaseClient()
    .from('chat_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function blockUser(conversationId: string, blockedUserId: string) {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await getSupabaseClient()
    .from('chat_participants')
    .update({ is_blocked: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', blockedUserId);

  if (error) throw error;
}
