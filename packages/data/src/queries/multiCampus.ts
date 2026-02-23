import type { Database } from "../types";
import { getSupabaseClient } from "../client";
import { snakeToCamelKeys, camelToSnakeKeys } from "../helpers/transform";

const supabase = getSupabaseClient();

// Types
type UserCampusAccessInsert = Database["public"]["Tables"]["user_campus_access"]["Insert"];
type UserCampusAccessUpdate = Database["public"]["Tables"]["user_campus_access"]["Update"];

type CampusScheduleInsert = Database["public"]["Tables"]["campus_schedules"]["Insert"];
type CampusScheduleUpdate = Database["public"]["Tables"]["campus_schedules"]["Update"];

// ============================================
// CAMPUSES
// ============================================

export const campusQueries = {
  getBySchool: (schoolId: string) => ({
    queryKey: ["campuses", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .eq("school_id", schoolId)
        .order("is_main", { ascending: false })
        .order("name");
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  // Alias for getBySchool (used by useSchoolConfig hooks)
  getAll: (schoolId: string) => ({
    queryKey: ["campuses", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .eq("school_id", schoolId)
        .order("is_main", { ascending: false })
        .order("name");
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ["campuses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getMain: (schoolId: string) => ({
    queryKey: ["campuses", schoolId, "main"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_main", true)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  create: () => ({
    mutationFn: async (campus: any) => {
      const snakeData = camelToSnakeKeys(campus);
      const { data, error } = await supabase
        .from("campuses")
        .insert(snakeData)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: { id: string;[key: string]: any }) => {
      const snakeData = camelToSnakeKeys(update);
      const { data, error } = await supabase
        .from("campuses")
        .update(snakeData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campuses")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
  }),
};

// ============================================
// USER CAMPUS ACCESS
// ============================================

export const userCampusAccessQueries = {
  getByUser: (userId: string, schoolId: string) => ({
    queryKey: ["user_campus_access", userId, schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_campus_access")
        .select(`
          *,
          campus:campuses(*)
        `)
        .eq("user_id", userId)
        .eq("school_id", schoolId);
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByCampus: (campusId: string) => ({
    queryKey: ["user_campus_access", campusId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_campus_access")
        .select(`
          *,
          user:users(id, first_name, last_name, email),
          campus:campuses(*)
        `)
        .eq("campus_id", campusId);
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  assign: () => ({
    mutationFn: async (access: UserCampusAccessInsert) => {
      const { data, error } = await supabase
        .from("user_campus_access")
        .insert(access)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: UserCampusAccessUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("user_campus_access")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  revoke: () => ({
    mutationFn: async ({ userId, campusId }: { userId: string; campusId: string }) => {
      const { data, error } = await supabase
        .from("user_campus_access")
        .delete()
        .eq("user_id", userId)
        .eq("campus_id", campusId)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),
};

// ============================================
// CLASS CAMPUS ASSIGNMENT
// ============================================

export const classCampusQueries = {
  updateCampus: () => ({
    mutationFn: async ({ classId, campusId }: { classId: string; campusId: string | null }) => {
      const { data, error } = await supabase
        .from("classes")
        .update({ campus_id: campusId })
        .eq("id", classId)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByCampus: (campusId: string) => ({
    queryKey: ["classes", campusId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("campus_id", campusId);
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),
};

// ============================================
// SESSION CAMPUS ASSIGNMENT
// ============================================

export const sessionCampusQueries = {
  updateCampus: () => ({
    mutationFn: async ({ sessionId, campusId }: { sessionId: string; campusId: string | null }) => {
      const { data, error } = await supabase
        .from("planned_sessions")
        .update({ campus_id: campusId })
        .eq("id", sessionId)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByCampus: (campusId: string, startDate: string, endDate: string) => ({
    queryKey: ["planned_sessions", campusId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planned_sessions")
        .select(`
          *,
          teacher:users!teacher_id(id, first_name, last_name),
          class:classes(id, name),
          subject:subjects(id, name),
          room:rooms(id, name, building)
        `)
        .eq("campus_id", campusId)
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),
};

// ============================================
// CAMPUS SCHEDULES
// ============================================

export const campusScheduleQueries = {
  getByCampus: (campusId: string) => ({
    queryKey: ["campus_schedules", campusId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campus_schedules")
        .select(`
          *,
          schedule:schedules(*)
        `)
        .eq("campus_id", campusId);
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  assign: () => ({
    mutationFn: async (assignment: CampusScheduleInsert) => {
      const { data, error } = await supabase
        .from("campus_schedules")
        .insert(assignment)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...update }: CampusScheduleUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("campus_schedules")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  remove: () => ({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("campus_schedules")
        .delete()
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),
};

// ============================================
// CAMPUS STATISTICS
// ============================================

export const campusStatisticsQueries = {
  getStats: (campusId: string) => ({
    queryKey: ["campus_statistics", campusId],
    queryFn: async () => {
      // Get class count
      const { count: classCount } = await supabase
        .from("classes")
        .select("*", { count: "exact", head: true })
        .eq("campus_id", campusId);

      // Get room count from campus_rooms table
      const { count: roomCount } = await supabase
        .from("campus_rooms")
        .select("*", { count: "exact", head: true })
        .eq("campus_id", campusId)
        .eq("is_active", true);

      // Get teacher count
      const { count: teacherCount } = await supabase
        .from("user_campus_access")
        .select("*", { count: "exact", head: true })
        .eq("campus_id", campusId)
        .eq("access_type", "full_access");

      return {
        classes: classCount || 0,
        rooms: roomCount || 0,
        teachers: teacherCount || 0,
      };
    },
  }),
};

// ============================================
// CAMPUS ROOMS
// ============================================

export const campusRoomsQueries = {
  getByCampus: (campusId: string) => ({
    queryKey: ["campus_rooms", campusId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campus_rooms", {
        p_campus_id: campusId,
      });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  checkAccess: (roomId: string, campusId: string) => ({
    queryKey: ["campus_room_access", roomId, campusId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_room_campus_access", {
        p_room_id: roomId,
        p_campus_id: campusId,
      });

      if (error) throw error;
      return data;
    },
  }),
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all campuses accessible to a user
 */
export async function getAccessibleCampuses(userId: string, schoolId: string) {
  const { data, error } = await supabase.rpc("get_accessible_campuses", {
    p_user_id: userId,
  });

  if (error) throw error;
  return snakeToCamelKeys(data);
}

/**
 * Check if user has access to a campus
 */
export async function checkUserCampusAccess(userId: string, campusId: string) {
  const { data, error } = await supabase.rpc("check_user_campus_access", {
    p_user_id: userId,
    p_campus_id: campusId,
  });

  if (error) throw error;
  return data;
}

/**
 * Check if multi-campus is enabled for a school
 */
export async function checkMultiCampusEnabled(schoolId: string) {
  const { data, error } = await supabase.rpc("check_multi_campus_enabled", {
    p_school_id: schoolId,
  });

  if (error) throw error;
  return data;
}

/**
 * Check if a room belongs to a campus
 */
export async function checkRoomCampusAccess(roomId: string, campusId: string) {
  const { data, error } = await supabase.rpc("check_room_campus_access", {
    p_room_id: roomId,
    p_campus_id: campusId,
  });

  if (error) throw error;
  return data;
}

/**
 * Get all rooms for a campus
 */
export async function getCampusRoomsList(campusId: string) {
  const { data, error } = await supabase.rpc("get_campus_rooms", {
    p_campus_id: campusId,
  });

  if (error) throw error;
  return snakeToCamelKeys(data);
}
