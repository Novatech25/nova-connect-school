import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserConversations, createConversation } from '../queries/chatConversations';
import type { CreateConversation } from '@novaconnect/core';

export function useChatConversations(userId: string) {
  return useQuery({
    queryKey: ['chat-conversations', userId],
    queryFn: () => getUserConversations(userId),
    enabled: !!userId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateConversation) => createConversation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}
