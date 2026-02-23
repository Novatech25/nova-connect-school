import { getSupabaseClient } from "../client";
import { snakeToCamelKeys, camelToSnakeKeys } from "../helpers";
import type { Notification, NotificationPreference, CreateNotification } from "@novaconnect/core";

export const notificationQueries = {
  getAll: (userId: string, filters?: { unreadOnly?: boolean; type?: string; limit?: number }) => ({
    queryKey: ["notifications", userId, filters],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("sent_at", { ascending: false });

      if (filters?.unreadOnly) {
        query = query.is("read_at", null);
      }

      if (filters?.type) {
        query = query.eq("type", filters.type);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data) as Notification[];
    },
  }),

  getUnreadCount: (userId: string) => ({
    queryKey: ["notifications", "unread-count", userId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) throw error;
      return count || 0;
    },
  }),

  markAsRead: () => ({
    mutationFn: async (notificationId: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("mark_notification_as_read", {
        notification_id: notificationId,
      });

      if (error) throw error;
      return data;
    },
  }),

  markAllAsRead: () => ({
    mutationFn: async (userId: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) throw error;
      return { success: true };
    },
  }),
};

export const notificationPreferenceQueries = {
  getAll: (userId: string) => ({
    queryKey: ["notification_preferences", userId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;
      return snakeToCamelKeys(data) as NotificationPreference[];
    },
  }),

  upsert: () => ({
    mutationFn: async (preference: Partial<NotificationPreference> & { userId: string; notificationType: string }) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("notification_preferences")
        .upsert(camelToSnakeKeys(preference), {
          onConflict: "user_id,notification_type",
        })
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as NotificationPreference;
    },
  }),
};
