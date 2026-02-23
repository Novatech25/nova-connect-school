import { useMutation, useQuery } from "@tanstack/react-query";
import { userQueries } from "../queries/users";
import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

export function useCurrentUser() {
  return useQuery(userQueries.getCurrent());
}

export function useUsers(schoolId?: string, roleName?: string) {
  // If schoolId is provided, get users by school
  if (schoolId) {
    const query = userQueries.getBySchool(schoolId, roleName);
    return useQuery({
      ...query,
      // Add stale time to prevent excessive refetches
      staleTime: 60000, // 1 minute
    });
  }

  // Otherwise return empty query
  return useQuery({
    queryKey: ["users", "none"],
    queryFn: async () => [],
    enabled: false,
  });
}

/**
 * Create a user account for an existing student or parent
 * This is used by admins to create portal access for students and parents
 */
export function useCreateUserAccount() {
  return useMutation({
    ...userQueries.createAccount(),
  });
}

/**
 * Get teachers from grades table for a school (for grades page filter)
 * This uses the RPC function which bypasses RLS and gets teachers who have created grades
 */
export function useTeachersFromGrades(schoolId?: string) {
  return useQuery({
    queryKey: ["teachers", "from-grades", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];

      // Try RPC function first (most efficient)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("get_teachers_for_school", { p_school_id: schoolId });

      if (!rpcError && rpcData && rpcData.length > 0) {
        console.log('[useTeachersFromGrades] Found teachers via RPC:', rpcData.length);
        return rpcData;
      }

      if (rpcError) {
        console.log('[useTeachersFromGrades] RPC error:', rpcError.message);
      }

      // Fallback: Query grades table directly
      const { data: gradesData, error: gradesError } = await supabase
        .from("grades")
        .select("teacher_id")
        .eq("school_id", schoolId);

      console.log('[useTeachersFromGrades] Grades query:', { error: gradesError, count: gradesData?.length });

      if (!gradesError && gradesData && gradesData.length > 0) {
        const teacherIds = [...new Set(gradesData.map(g => g.teacher_id))];
        console.log('[useTeachersFromGrades] Unique teacher IDs:', teacherIds.length);

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("*")
          .in("id", teacherIds)
          .eq("school_id", schoolId);

        if (!usersError && usersData && usersData.length > 0) {
          console.log('[useTeachersFromGrades] Found teachers via fallback:', usersData.length);
          return usersData;
        }

        if (usersError) {
          console.error('[useTeachersFromGrades] Users query error:', usersError);
        }
      }

      console.warn('[useTeachersFromGrades] No teachers found');
      return [];
    },
    enabled: !!schoolId,
    staleTime: 60000, // 1 minute
  });
}

