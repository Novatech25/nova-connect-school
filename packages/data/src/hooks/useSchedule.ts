import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";
import {
  plannedSessionQueries,
  scheduleConstraintQueries,
  scheduleQueries,
  scheduleSlotQueries,
  scheduleVersionQueries,
} from "../queries/schedule";

// ============================================
// SCHEDULES
// ============================================

export function useSchedules(
  schoolId: string,
  academicYearId?: string,
  status?: string,
) {
  return useQuery(scheduleQueries.getAll(schoolId, academicYearId, status));
}

export function useSchedule(id: string) {
  return useQuery(scheduleQueries.getById(id));
}

export function useCurrentSchedule(schoolId: string, academicYearId: string) {
  return useQuery(scheduleQueries.getCurrent(schoolId, academicYearId));
}

export function useScheduleWithSlots(id: string) {
  return useQuery(scheduleQueries.getWithSlots(id));
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleQueries.create(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleQueries.update(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", data.id] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

export function useDuplicateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleQueries.duplicate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });
}

// ============================================
// SLOTS
// ============================================

export function useScheduleSlots(scheduleId: string) {
  return useQuery(scheduleSlotQueries.getAll(scheduleId));
}

export function useScheduleSlotsByTeacher(
  teacherId: string,
  scheduleId?: string,
) {
  return useQuery(scheduleSlotQueries.getByTeacher(teacherId, scheduleId));
}

export function useScheduleSlotsByClass(classId: string, scheduleId?: string) {
  return useQuery(scheduleSlotQueries.getByClass(classId, scheduleId));
}

export function useScheduleSlotsByRoom(roomId: string, scheduleId?: string) {
  return useQuery(scheduleSlotQueries.getByRoom(roomId, scheduleId));
}

export function useScheduleSlotsByDay(scheduleId: string, dayOfWeek: string) {
  return useQuery(scheduleSlotQueries.getByDay(scheduleId, dayOfWeek));
}

export function useScheduleSlot(id: string) {
  return useQuery(scheduleSlotQueries.getById(id));
}

export function useCreateScheduleSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleSlotQueries.create(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
      queryClient.invalidateQueries({
        queryKey: ["schedule_slots", data.scheduleId],
      });
    },
  });
}

export function useCreateBulkScheduleSlots() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleSlotQueries.createBulk(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
      if (data.length > 0) {
        queryClient.invalidateQueries({
          queryKey: ["schedule_slots", data[0].scheduleId],
        });
      }
    },
  });
}

export function useUpdateScheduleSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleSlotQueries.update(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
      queryClient.invalidateQueries({
        queryKey: ["schedule_slots", data.scheduleId],
      });
      queryClient.invalidateQueries({ queryKey: ["schedule_slots", data.id] });
    },
  });
}

export function useDeleteScheduleSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleSlotQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
    },
  });
}

export function useDeleteBulkScheduleSlots() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleSlotQueries.deleteBulk(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_slots"] });
    },
  });
}

// ============================================
// VERSIONS
// ============================================

export function useScheduleVersions(scheduleId: string) {
  return useQuery(scheduleVersionQueries.getAll(scheduleId));
}

export function useScheduleVersion(id: string) {
  return useQuery(scheduleVersionQueries.getById(id));
}

export function useLatestScheduleVersion(scheduleId: string) {
  return useQuery(scheduleVersionQueries.getLatest(scheduleId));
}

// ============================================
// CONSTRAINTS
// ============================================

export function useScheduleConstraints(schoolId: string, isActive?: boolean) {
  return useQuery(scheduleConstraintQueries.getAll(schoolId, isActive));
}

export function useScheduleConstraintsByType(
  schoolId: string,
  constraintType: string,
) {
  return useQuery(
    scheduleConstraintQueries.getByType(schoolId, constraintType),
  );
}

export function useCreateScheduleConstraint() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleConstraintQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_constraints"] });
    },
  });
}

export function useUpdateScheduleConstraint() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleConstraintQueries.update(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_constraints"] });
      queryClient.invalidateQueries({
        queryKey: ["schedule_constraints", data.id],
      });
    },
  });
}

export function useDeleteScheduleConstraint() {
  const queryClient = useQueryClient();
  return useMutation({
    ...scheduleConstraintQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_constraints"] });
    },
  });
}

// ============================================
// PLANNED SESSIONS
// ============================================

export function usePlannedSessions(
  schoolId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    teacherId?: string;
    classId?: string;
    isCompleted?: boolean;
    isCancelled?: boolean;
  },
) {
  return useQuery(plannedSessionQueries.getAll(schoolId, filters));
}

export function usePlannedSessionsByTeacher(
  teacherId: string,
  startDate: string,
  endDate: string,
) {
  return useQuery(
    plannedSessionQueries.getByTeacher(teacherId, startDate, endDate),
  );
}

export function usePlannedSessionsByClass(
  classId: string,
  startDate: string,
  endDate: string,
) {
  return useQuery(
    plannedSessionQueries.getByClass(classId, startDate, endDate),
  );
}

export function useUpcomingSessions(
  entityId: string,
  entityType: "teacher" | "class",
  limit: number = 10,
) {
  return useQuery(
    plannedSessionQueries.getUpcoming(entityId, entityType, limit),
  );
}

export function usePlannedSession(id: string) {
  return useQuery(plannedSessionQueries.getById(id));
}

export function useMarkSessionCompleted() {
  const queryClient = useQueryClient();
  return useMutation({
    ...plannedSessionQueries.markCompleted(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["planned_sessions"] });
      queryClient.invalidateQueries({
        queryKey: ["planned_sessions", data.id],
      });
    },
  });
}

export function useCancelSession() {
  const queryClient = useQueryClient();
  return useMutation({
    ...plannedSessionQueries.cancel(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["planned_sessions"] });
      queryClient.invalidateQueries({
        queryKey: ["planned_sessions", data.id],
      });
    },
  });
}

// ============================================
// PUBLISH SCHEDULE (Edge Function)
// ============================================

interface PublishScheduleParams {
  scheduleId: string;
  notifyUsers?: boolean;
}

interface PublishScheduleResponse {
  success?: boolean;
  id?: string;
  schedule?: any;
  sessionsCreated?: number;
  violations?: any[];
  error?: string;
}

export function usePublishSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scheduleId,
      notifyUsers = false,
    }: PublishScheduleParams): Promise<PublishScheduleResponse> => {
      console.log("PUBLISH: Using Edge Function"); // DEBUG

      // Call the Edge Function using Supabase client
      const supabase = getSupabaseClient();

      // Check auth state
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("PUBLISH: Auth check", {
        hasSession: !!session,
        hasToken: !!session?.access_token,
        user: session?.user?.id,
        error: sessionError
      });

      if (!session?.access_token) {
        console.error("PUBLISH: No access token found!");
      }

      const { data, error } = await supabase.functions.invoke<PublishScheduleResponse>(
        'publish-schedule',
        {
          body: {
            scheduleId,
            notifyUsers,
          },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined
        }
      );

      if (error) {
        console.error("PUBLISH: Invoke Error Raw:", error);
        if (error instanceof Error) {
          console.error("PUBLISH: Error Message:", error.message);
          console.error("PUBLISH: Error Stack:", error.stack);
        }
        // Extract the response body from the FunctionsHttpError
        let errorBody: any = null;
        try {
          // Supabase SDK v2: error.context is a Response object, .json() returns parsed object
          if ((error as any).context && typeof (error as any).context.json === 'function') {
            errorBody = await (error as any).context.json();
            console.error("PUBLISH: Error Body:", errorBody);
          }
        } catch (e) {
          console.error("PUBLISH: Could not parse error body:", e);
        }

        const detailedMessage = errorBody?.error || errorBody?.details || error.message || "Failed to publish schedule (Edge Function error)";
        throw new Error(detailedMessage);
      }

      if (!data || !data.success) {
        console.error("PUBLISH: Data Error:", data);
        throw new Error(data?.error || "Publication failed (Business logic error)");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedule_versions"] });
      queryClient.invalidateQueries({ queryKey: ["planned_sessions"] });
    },
  });
}
