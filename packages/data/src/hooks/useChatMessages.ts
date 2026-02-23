import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConversationMessages, sendMessage, markMessagesAsRead, deleteMessage, clearConversation, blockUser } from '../queries/chatMessages';
import type { SendMessage } from '@novaconnect/core';

export function useChatMessages(conversationId: string, limit = 50) {
  return useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => getConversationMessages(conversationId, limit),
    enabled: !!conversationId,
    refetchInterval: 5000, // Automagically refetch every 5s as a fallback for Realtime
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessage) => sendMessage(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}

export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => markMessagesAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
    }
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onSuccess: () => {
      // Invalidate all chat messages to refetch
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    }
  });
}

export function useClearConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => clearConversation(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    }
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string, userId: string }) => blockUser(conversationId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.conversationId] });
    }
  });
}
