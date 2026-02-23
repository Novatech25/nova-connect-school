import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messagingQueries, type BroadcastTargetType } from "../queries/messaging";

export function useBroadcastHistory(schoolId: string, limit = 50) {
  return useQuery({
    ...messagingQueries.getHistory(schoolId, limit),
    enabled: !!schoolId,
  });
}

export function useBroadcastStats(schoolId: string) {
  return useQuery({
    ...messagingQueries.getStats(schoolId),
    enabled: !!schoolId,
  });
}

export function useRecipientsList(
  schoolId: string,
  targetType: BroadcastTargetType,
  classId?: string
) {
  return useQuery({
    ...messagingQueries.getRecipients(schoolId, targetType, classId),
    enabled: !!schoolId && targetType !== 'all',
  });
}

export function useMessagingClasses(schoolId: string) {
  return useQuery({
    ...messagingQueries.getClasses(schoolId),
    enabled: !!schoolId,
  });
}

export function useSendBroadcast() {
  const queryClient = useQueryClient();
  return useMutation({
    ...messagingQueries.sendBroadcast(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
