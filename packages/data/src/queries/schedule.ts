import type {
  CreateSchedule,
  CreateScheduleConstraint,
  CreateScheduleSlot,
  PlannedSession,
  Schedule,
  ScheduleConstraint,
  ScheduleSlot,
  ScheduleVersion,
  UpdateSchedule,
  UpdateScheduleConstraint,
  UpdateScheduleSlot,
} from "@novaconnect/core";
import { getSupabaseClient } from "../client";
import { camelToSnakeKeys, snakeToCamelKeys } from "../helpers";

// ============================================
// SCHEDULES
// ============================================

export const scheduleQueries = {
  getAll: (schoolId: string, academicYearId?: string, status?: string) => ({
    queryKey: ["schedules", schoolId, academicYearId, status],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("schedules")
        .select(
          `
          *,
          academic_year:academic_years(*),
          published_by_user:users(id, first_name, last_name, email)
        `,
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (academicYearId) {
        query = query.eq("academic_year_id", academicYearId);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data) as Schedule[];
    },
  }),

  getById: (id: string) => ({
    queryKey: ["schedules", id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedules")
        .select(
          `
          *,
          academic_year:academic_years(*),
          published_by_user:users(id, first_name, last_name, email)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as Schedule;
    },
  }),

  getCurrent: (schoolId: string, academicYearId: string) => ({
    queryKey: ["schedules", "current", schoolId, academicYearId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedules")
        .select(
          `
          *,
          academic_year:academic_years(*),
          published_by_user:users(id, first_name, last_name, email)
        `,
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", academicYearId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as Schedule;
    },
  }),

  getWithSlots: (id: string) => ({
    queryKey: ["schedules", id, "with-slots"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedules")
        .select(
          `
          *,
          academic_year:academic_years(*),
          published_by_user:users(id, first_name, last_name, email),
          slots:schedule_slots(
            *,
            teacher:users(id, first_name, last_name, email, metadata),
            class:classes(*),
            subject:subjects(*),
            room:rooms(*),
            campus:campuses(*)
          ),
          versions:schedule_versions(*)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as Schedule & {
        slots: ScheduleSlot[];
        versions: ScheduleVersion[];
      };
    },
  }),

  create: () => ({
    mutationFn: async (schedule: CreateSchedule) => {
      const supabase = getSupabaseClient();

      console.log("Calling create_schedule_v5 RPC with:", {
        p_school_id: schedule.schoolId,
        p_academic_year_id: schedule.academicYearId,
        p_name: schedule.name,
      }); // DEBUG

      // Use RPC V5 (Auto-increment version)
      const { data, error } = await supabase.rpc("create_schedule_v5", {
        p_school_id: schedule.schoolId,
        p_academic_year_id: schedule.academicYearId,
        p_name: schedule.name,
        p_description: schedule.description || null,
        p_metadata: schedule.metadata || null,
      });

      if (error) {
        console.error("RPC V5 Error Object:", error);
        console.error(
          "RPC V5 Error Stringified:",
          JSON.stringify(error, Object.getOwnPropertyNames(error)),
        );
        throw new Error(
          `Erreur RPC V5: ${error.message || "Erreur inconnue (check console)"}`,
        );
      }

      if (!data) {
        throw new Error("Aucune donnée retournée après la création (RPC V5).");
      }

      console.log("RPC V5 Success, data:", data);

      return snakeToCamelKeys(data) as Schedule;
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateSchedule) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedules")
        .update(camelToSnakeKeys(updates))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as Schedule;
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();

      // Delete the schedule (slots, versions, planned_sessions cascade automatically via FK)
      const { data, error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;

      // Verify deletion actually happened (RLS may silently block)
      if (!data || data.length === 0) {
        throw new Error(
          "La suppression a échoué. Vérifiez que vous avez les droits nécessaires.",
        );
      }

      return { id };
    },
  }),

  duplicate: () => ({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const supabase = getSupabaseClient();

      // First, get the original schedule
      const { data: original, error: fetchError } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Create duplicate with new name and reset version
      const { data: duplicate, error: insertError } = await supabase
        .from("schedules")
        .insert({
          school_id: original.school_id,
          academic_year_id: original.academic_year_id,
          name: newName,
          description: original.description,
          status: "draft",
          version: 1,
          metadata: original.metadata,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Copy all slots to the new schedule
      const { data: slots, error: slotsError } = await supabase
        .from("schedule_slots")
        .select("*")
        .eq("schedule_id", id);

      if (slotsError) throw slotsError;

      if (slots && slots.length > 0) {
        const slotsToInsert = slots.map((slot: any) => ({
          schedule_id: duplicate.id,
          school_id: slot.school_id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          teacher_id: slot.teacher_id,
          class_id: slot.class_id,
          subject_id: slot.subject_id,
          room_id: slot.room_id,
          campus_id: slot.campus_id,
          is_recurring: slot.is_recurring,
          recurrence_end_date: slot.recurrence_end_date,
          notes: slot.notes,
          metadata: slot.metadata,
        }));

        const { error: insertSlotsError } = await supabase
          .from("schedule_slots")
          .insert(slotsToInsert);

        if (insertSlotsError) throw insertSlotsError;
      }

      return snakeToCamelKeys(duplicate) as Schedule;
    },
  }),
};

// ============================================
// SLOTS
// ============================================

export const scheduleSlotQueries = {
  getAll: (scheduleId: string) => ({
    queryKey: ["schedule_slots", scheduleId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_slots")
        .select(
          `
          *,
          teacher:users(id, first_name, last_name, email, metadata),
          class:classes(*),
          subject:subjects(*),
          room:rooms(*),
          campus:campuses(*)
        `,
        )
        .eq("schedule_id", scheduleId)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot[];
    },
  }),

  getByTeacher: (teacherId: string, scheduleId?: string) => ({
    queryKey: ["schedule_slots", "teacher", teacherId, scheduleId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("schedule_slots")
        .select(
          `
          *,
          schedule:schedules(*),
          class:classes(*),
          subject:subjects(*),
          room:rooms(*),
          campus:campuses(*)
        `,
        )
        .eq("teacher_id", teacherId);

      if (scheduleId) {
        query = query.eq("schedule_id", scheduleId);
      }

      const { data, error } = await query
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot[];
    },
  }),

  getByClass: (classId: string, scheduleId?: string) => ({
    queryKey: ["schedule_slots", "class", classId, scheduleId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("schedule_slots")
        .select(
          `
          *,
          schedule:schedules(*),
          teacher:users(id, first_name, last_name),
          subject:subjects(*),
          room:rooms(*),
          campus:campuses(*)
        `,
        )
        .eq("class_id", classId);

      if (scheduleId) {
        query = query.eq("schedule_id", scheduleId);
      }

      const { data, error } = await query
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot[];
    },
  }),

  getByRoom: (roomId: string, scheduleId?: string) => ({
    queryKey: ["schedule_slots", "room", roomId, scheduleId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("schedule_slots")
        .select(
          `
          *,
          schedule:schedules(*),
          teacher:users(id, first_name, last_name),
          class:classes(*),
          subject:subjects(*),
          campus:campuses(*)
        `,
        )
        .eq("room_id", roomId);

      if (scheduleId) {
        query = query.eq("schedule_id", scheduleId);
      }

      const { data, error } = await query
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot[];
    },
  }),

  getByDay: (scheduleId: string, dayOfWeek: string) => ({
    queryKey: ["schedule_slots", scheduleId, dayOfWeek],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_slots")
        .select(
          `
          *,
          teacher:users(id, first_name, last_name),
          class:classes(*),
          subject:subjects(*),
          room:rooms(*),
          campus:campuses(*)
        `,
        )
        .eq("schedule_id", scheduleId)
        .eq("day_of_week", dayOfWeek)
        .order("start_time");

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot[];
    },
  }),

  getById: (id: string) => ({
    queryKey: ["schedule_slots", id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_slots")
        .select(
          `
          *,
          schedule:schedules(*),
          teacher:users(id, first_name, last_name),
          class:classes(*),
          subject:subjects(*),
          room:rooms(*),
          campus:campuses(*)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot;
    },
  }),

  create: () => ({
    mutationFn: async (slot: CreateScheduleSlot) => {
      const supabase = getSupabaseClient();

      // Log pour debugging
      console.log('[scheduleSlotQueries.create] Input:', slot);
      const snakeData = camelToSnakeKeys(slot);
      console.log('[scheduleSlotQueries.create] Converted to snake_case:', snakeData);

      const { data, error } = await supabase
        .from("schedule_slots")
        .insert(snakeData)
        .select()
        .single();

      if (error) {
        console.error('[scheduleSlotQueries.create] Error:', error);
        console.error('[scheduleSlotQueries.create] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        // Create a meaningful error message
        const errorMessage =
          error.message ||
          error.details ||
          error.hint ||
          `Erreur de base de données (code: ${error.code || 'inconnu'})`;

        throw new Error(errorMessage);
      }

      if (!data) {
        throw new Error('Aucune donnée retournée après la création du créneau');
      }

      console.log('[scheduleSlotQueries.create] Success:', data);
      return snakeToCamelKeys(data) as ScheduleSlot;
    },
  }),

  createBulk: () => ({
    mutationFn: async (slots: CreateScheduleSlot[]) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_slots")
        .insert(camelToSnakeKeys(slots))
        .select();

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot[];
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateScheduleSlot) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_slots")
        .update(camelToSnakeKeys(updates))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleSlot;
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("schedule_slots")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id };
    },
  }),

  deleteBulk: () => ({
    mutationFn: async (ids: string[]) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("schedule_slots")
        .delete()
        .in("id", ids);

      if (error) throw error;
      return { count: ids.length };
    },
  }),
};

// ============================================
// VERSIONS
// ============================================

export const scheduleVersionQueries = {
  getAll: (scheduleId: string) => ({
    queryKey: ["schedule_versions", scheduleId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_versions")
        .select(
          `
          *,
          created_by_user:users(id, first_name, last_name)
        `,
        )
        .eq("schedule_id", scheduleId)
        .order("version", { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleVersion[];
    },
  }),

  getById: (id: string) => ({
    queryKey: ["schedule_versions", id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_versions")
        .select(
          `
          *,
          created_by_user:users(id, first_name, last_name)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleVersion;
    },
  }),

  getLatest: (scheduleId: string) => ({
    queryKey: ["schedule_versions", scheduleId, "latest"],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_versions")
        .select(
          `
          *,
          created_by_user:users(id, first_name, last_name)
        `,
        )
        .eq("schedule_id", scheduleId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleVersion;
    },
  }),
};

// ============================================
// CONSTRAINTS
// ============================================

export const scheduleConstraintQueries = {
  getAll: (schoolId: string, isActive?: boolean) => ({
    queryKey: ["schedule_constraints", schoolId, isActive],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("schedule_constraints")
        .select("*")
        .eq("school_id", schoolId)
        .order("priority", { ascending: true });

      if (isActive !== undefined) {
        query = query.eq("is_active", isActive);
      }

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleConstraint[];
    },
  }),

  getByType: (schoolId: string, constraintType: string) => ({
    queryKey: ["schedule_constraints", schoolId, constraintType],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_constraints")
        .select("*")
        .eq("school_id", schoolId)
        .eq("constraint_type", constraintType)
        .order("priority", { ascending: true });

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleConstraint[];
    },
  }),

  create: () => ({
    mutationFn: async (constraint: CreateScheduleConstraint) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_constraints")
        .insert(camelToSnakeKeys(constraint))
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleConstraint;
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateScheduleConstraint) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("schedule_constraints")
        .update(camelToSnakeKeys(updates))
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as ScheduleConstraint;
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("schedule_constraints")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id };
    },
  }),
};

// ============================================
// PLANNED SESSIONS
// ============================================

export const plannedSessionQueries = {
  getAll: (
    schoolId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      teacherId?: string;
      classId?: string;
      isCompleted?: boolean;
      isCancelled?: boolean;
    },
  ) => ({
    queryKey: ["planned_sessions", schoolId, filters],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from("planned_sessions")
        .select(
          `
          *,
          teacher:users(id, first_name, last_name),
          class:classes(*),
          subject:subjects(*),
          room:rooms(*),
          schedule_slot:schedule_slots(
            *,
            day_of_week
          )
        `,
        )
        .eq("school_id", schoolId)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (filters?.startDate) {
        query = query.gte("session_date", filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte("session_date", filters.endDate);
      }

      if (filters?.teacherId) {
        query = query.eq("teacher_id", filters.teacherId);
      }

      if (filters?.classId) {
        query = query.eq("class_id", filters.classId);
      }

      if (filters?.isCompleted !== undefined) {
        query = query.eq("is_completed", filters.isCompleted);
      }

      if (filters?.isCancelled !== undefined) {
        query = query.eq("is_cancelled", filters.isCancelled);
      }

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data) as PlannedSession[];
    },
  }),

  getByTeacher: (teacherId: string, startDate: string, endDate: string) => ({
    queryKey: ["planned_sessions", "teacher", teacherId, startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("planned_sessions")
        .select(
          `
          *,
          teacher:users(id, first_name, last_name),
          class:classes(*),
          subject:subjects(*),
          room:rooms(*),
          schedule_slot:schedule_slots(
            *,
            day_of_week
          )
        `,
        )
        .eq("teacher_id", teacherId)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return snakeToCamelKeys(data) as PlannedSession[];
    },
  }),

  getByClass: (classId: string, startDate: string, endDate: string) => ({
    queryKey: ["planned_sessions", "class", classId, startDate, endDate],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("planned_sessions")
        .select(
          `
          *,
          teacher:users(id, first_name, last_name),
          subject:subjects(*),
          room:rooms(*),
          schedule_slot:schedule_slots(
            *,
            day_of_week
          )
        `,
        )
        .eq("class_id", classId)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return snakeToCamelKeys(data) as PlannedSession[];
    },
  }),

  getUpcoming: (
    entityId: string,
    entityType: "teacher" | "class",
    limit: number = 10,
  ) => ({
    queryKey: ["planned_sessions", "upcoming", entityType, entityId, limit],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const column = entityType === "teacher" ? "teacher_id" : "class_id";

      const { data, error } = await supabase
        .from("planned_sessions")
        .select(
          `
          *,
          ${entityType === "teacher" ? "class" : "teacher"}:${entityType === "teacher" ? "classes" : "users"}(id, name, first_name, last_name),
          subject:subjects(*),
          room:rooms(*)
        `,
        )
        .eq(column, entityId)
        .gte("session_date", new Date().toISOString().split("T")[0])
        .eq("is_cancelled", false)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(limit);

      if (error) throw error;
      return snakeToCamelKeys(data) as PlannedSession[];
    },
  }),

  getById: (id: string) => ({
    queryKey: ["planned_sessions", id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("planned_sessions")
        .select(
          `
          *,
          teacher:users(id, first_name, last_name),
          class:classes(*),
          subject:subjects(*),
          room:rooms(*),
          schedule_slot:schedule_slots(
            *,
            day_of_week
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as PlannedSession;
    },
  }),

  markCompleted: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("planned_sessions")
        .update({ is_completed: true })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as PlannedSession;
    },
  }),

  cancel: () => ({
    mutationFn: async (id: string, reason: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("planned_sessions")
        .update({
          is_cancelled: true,
          cancellation_reason: reason,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as PlannedSession;
    },
  }),
};
