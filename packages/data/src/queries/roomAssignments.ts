import type { Database } from "../types";
import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

export type RoomAssignment = Database["public"]["Tables"]["room_assignments"]["Row"];
export type RoomAssignmentInsert = Database["public"]["Tables"]["room_assignments"]["Insert"];
export type RoomAssignmentUpdate = Database["public"]["Tables"]["room_assignments"]["Update"];

export interface CalculateRoomAssignmentsRequest {
  scheduleId?: string;
  sessionDate?: string;
  schoolId: string;
  autoPublish?: boolean;
}

export interface CalculateRoomAssignmentsResponse {
  success: boolean;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  insufficientCapacity: Array<{
    teacherId: string;
    subjectId: string;
    requiredCapacity: number;
    time: string;
  }>;
  message: string;
  error?: string;
}

export interface PublishRoomAssignmentsRequest {
  sessionDate: string;
  schoolId: string;
}

export interface PublishRoomAssignmentsResponse {
  success: boolean;
  published: number;
  notificationsSent: number;
  message: string;
  error?: string;
}

export interface SendRoomAssignmentNotificationsRequest {
  notificationWindow: 60 | 15;
  sessionDate?: string;
}

export interface SendRoomAssignmentNotificationsResponse {
  success: boolean;
  notificationsSent: number;
  message: string;
  error?: string;
}

export const roomAssignmentQueries = {
  // Get room assignments for a date range
  getByDateRange: (schoolId: string, startDate: string, endDate: string) => ({
    queryKey: ["room_assignments", schoolId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_assignments")
        .select(`
          *,
          assigned_room:rooms(id, name, code, campus_id, capacity),
          teacher:users!teacher_id(id, first_name, last_name),
          subject:subjects(id, name, code)
        `)
        .eq("school_id", schoolId)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  }),

  // Get room assignments for a specific date
  getByDate: (schoolId: string, sessionDate: string) => ({
    queryKey: ["room_assignments", schoolId, sessionDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_assignments")
        .select(`
          *,
          assigned_room:rooms(id, name, code, campus_id, capacity),
          teacher:users!teacher_id(id, first_name, last_name),
          subject:subjects(id, name, code)
        `)
        .eq("school_id", schoolId)
        .eq("session_date", sessionDate)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  }),

  // Get room assignment statistics
  getStats: (schoolId: string, startDate: string, endDate: string) => ({
    queryKey: ["room_assignment_stats", schoolId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_assignments")
        .select("status, capacity_status, total_students")
        .eq("school_id", schoolId)
        .gte("session_date", startDate)
        .lte("session_date", endDate);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        draft: 0,
        published: 0,
        updated: 0,
        cancelled: 0,
        sufficient: 0,
        insufficient: 0,
        optimal: 0,
        totalStudents: 0,
      };

      data?.forEach((item) => {
        if (item.status) stats[item.status as keyof typeof stats]++;
        if (item.capacity_status) stats[item.capacity_status as keyof typeof stats]++;
        stats.totalStudents += item.total_students || 0;
      });

      return stats;
    },
  }),

  // Calculate room assignments via RPC
  calculate: () => ({
    mutationFn: async (request: CalculateRoomAssignmentsRequest) => {
      const { data, error } = await supabase.rpc(
        'calculate_room_assignments_rpc',
        {
          p_school_id: request.schoolId,
          p_session_date: request.sessionDate,
          p_schedule_id: request.scheduleId || null,
          p_auto_publish: request.autoPublish || false,
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to calculate room assignments");
      }

      return data as CalculateRoomAssignmentsResponse;
    },
  }),

  // Publish room assignments via RPC
  publish: () => ({
    mutationFn: async (request: PublishRoomAssignmentsRequest) => {
      const { data, error } = await supabase.rpc(
        'publish_room_assignments_rpc',
        {
          p_school_id: request.schoolId,
          p_session_date: request.sessionDate,
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to publish room assignments");
      }

      return data as PublishRoomAssignmentsResponse;
    },
  }),

  // Send room assignment notifications via RPC
  sendNotifications: () => ({
    mutationFn: async (request: SendRoomAssignmentNotificationsRequest) => {
      const { data, error } = await supabase.rpc(
        'send_room_assignment_notifications_rpc',
        {
          p_notification_window: request.notificationWindow,
          p_session_date: request.sessionDate || null,
        }
      );

      if (error) {
        throw new Error(error.message || "Failed to send notifications");
      }

      return data as SendRoomAssignmentNotificationsResponse;
    },
  }),

  // Update a room assignment manually
  update: () => ({
    mutationFn: async ({ id, ...updates }: { id: string } & RoomAssignmentUpdate) => {
      const { data, error } = await supabase
        .from("room_assignments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Delete a room assignment
  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("room_assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return true;
    },
  }),
};
