import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";

interface PublishScheduleRpcParams {
  scheduleId: string;
  notifyUsers?: boolean;
}

interface PublishScheduleRpcResponse {
  success?: boolean;
  schedule?: any;
  sessionsCreated?: number;
  slotsCount?: number;
  error?: string;
  detail?: string;
}

/**
 * Hook to publish schedule using RPC function (fallback when Edge Function is not available)
 * This is a simpler version that only updates the status and creates version snapshot
 * It does NOT generate planned sessions (use the Edge Function for full functionality)
 */
export function usePublishScheduleRpc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      notifyUsers = false,
    }: PublishScheduleRpcParams): Promise<PublishScheduleRpcResponse> => {
      console.log("PUBLISH: Using RPC function (fallback)", { scheduleId, notifyUsers });

      const supabase = getSupabaseClient();

      // Call the RPC function directly
      const { data, error } = await supabase.rpc("publish_schedule_rpc_v3", {
        p_schedule_id: scheduleId,
        p_notify_users: notifyUsers,
      });

      if (error) {
        console.error("PUBLISH RPC Error:", error);
        throw new Error(error.message || "Failed to publish schedule via RPC");
      }

      if (!data || !data.success) {
        console.error("PUBLISH RPC Failed:", data);
        throw new Error(data?.error || data?.detail || "Publication failed via RPC");
      }

      console.log("PUBLISH RPC Success:", data);
      return data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedule_versions"] });
      queryClient.invalidateQueries({ queryKey: ["planned_sessions"] });
    },
  });
}
