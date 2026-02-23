import { getSupabaseClient } from '../client';
import type { CreateConversation, Conversation } from '@novaconnect/core';

export async function createConversation(data: CreateConversation) {
  const { participantIds, ...conversationData } = data;

  // Créer conversation
  const { data: conversation, error: convError } = await getSupabaseClient()
    .from('chat_conversations')
    .insert({
      ...conversationData,
      created_by: (await getSupabaseClient().auth.getUser()).data.user?.id,
    })
    .select()
    .single();

  if (convError) throw convError;

  // Ajouter participants
  const participants = participantIds.map(userId => ({
    conversation_id: conversation.id,
    user_id: userId,
    role: userId === conversation.created_by ? 'teacher' : 'parent',
  }));

  const { error: partError } = await getSupabaseClient()
    .from('chat_participants')
    .insert(participants);

  if (partError) throw partError;

  return conversation;
}

export async function getUserConversations(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('chat_conversations')
    .select(`
      *,
      participants:chat_participants(
        user_id,
        role,
        last_read_at,
        is_blocked
      )
    `)
    .eq('participants.user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  // Fetch last message for each conversation
  const conversationsWithLastMessage = await Promise.all(
    (data || []).map(async (conv) => {
      const { data: lastMessage } = await getSupabaseClient()
        .from('chat_messages')
        .select('id, content, sent_at, sender_id')
        .eq('conversation_id', conv.id)
        .is('deleted_at', null)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...conv,
        last_message: lastMessage || null,
      };
    })
  );

  return conversationsWithLastMessage;
}

export async function getConversationById(conversationId: string) {
  const { data, error } = await getSupabaseClient()
    .from('chat_conversations')
    .select(`
      *,
      participants:chat_participants(
        user_id,
        role,
        last_read_at,
        is_blocked,
        user:users(id, first_name, last_name, avatar_url)
      )
    `)
    .eq('id', conversationId)
    .single();

  if (error) throw error;
  return data;
}
