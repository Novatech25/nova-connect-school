'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../client';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '@novaconnect/core';

export function useRealtimeChat(conversationId: string) {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('New message received:', payload);
          queryClient.invalidateQueries({
            queryKey: ['chat-messages', conversationId]
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('Message updated:', payload);
          queryClient.invalidateQueries({
            queryKey: ['chat-messages', conversationId]
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('Participant updated:', payload);
          queryClient.invalidateQueries({
            queryKey: ['chat-conversation', conversationId]
          });
        }
      )
      .subscribe((status) => {
        console.log('Chat realtime status:', status);
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [conversationId, supabase, queryClient]);

  return { isSubscribed };
}
