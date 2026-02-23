import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationQueries, notificationPreferenceQueries } from "../queries/notifications";

export function useNotifications(
  userId: string,
  filters?: { unreadOnly?: boolean; type?: string; limit?: number }
) {
  return useQuery(notificationQueries.getAll(userId, filters));
}

export function useUnreadNotificationsCount(userId: string) {
  return useQuery(notificationQueries.getUnreadCount(userId));
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    ...notificationQueries.markAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    ...notificationQueries.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotificationPreferences(userId: string) {
  return useQuery(notificationPreferenceQueries.getAll(userId));
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    ...notificationPreferenceQueries.upsert(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_preferences"] });
    },
  });
}
