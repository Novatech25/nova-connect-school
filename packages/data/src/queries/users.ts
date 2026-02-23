import { snakeToCamelKeys } from "../helpers/transform";
import type { Database } from "../types";
import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export const userQueries = {
  // Get current user
  getCurrent: () => ({
    queryKey: ["users", "current"],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      if (!user) throw new Error("User not authenticated");

      // Fetch user profile from public.users table
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      // Si school_id n'est pas dans le profil, le récupérer depuis user_roles
      let schoolId = profile?.school_id;
      if (!schoolId) {
        const { data: userRole, error: userRoleError } = await supabase
          .from("user_roles")
          .select("school_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (!userRoleError && userRole) {
          schoolId = userRole.school_id;
        }
      }

      return {
        ...profile,
        school_id: schoolId,
      };
    },
  }),

  // Get user by ID
  getById: (id: string) => ({
    queryKey: ["users", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Get users by school
  getBySchool: (schoolId: string, roleName?: string) => ({
    queryKey: ["users", "school", schoolId, roleName],
    queryFn: async () => {
      // For teacher role, use role-based query (original behavior)
      // This ensures ALL teachers are shown, not just those with grades
      if (roleName) {
        console.log(`[getBySchool] Searching for role: ${roleName}`);
        // First get the role ID
        const { data: roleData, error: roleError } = await supabase
          .from("roles")
          .select("id")
          .ilike("name", roleName)
          .maybeSingle();

        if (roleError) {
          console.error('[getBySchool] Role query error:', roleError);
          throw roleError;
        }
        if (!roleData) {
          console.warn(`[getBySchool] Role ${roleName} not found`);
          return [];
        }

        console.log(`[getBySchool] Role found: ${roleData.id}`);

        // 1. Get user_ids from user_roles
        const { data: userRoles, error: userRolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role_id", roleData.id)
          .eq("school_id", schoolId);

        if (userRolesError) {
          console.error('[getBySchool] UserRoles query error:', userRolesError);
          // Don't throw, just log and continue with empty array for this source
        }
        
        const roleUserIds = userRoles?.map((ur) => ur.user_id) || [];
        console.log(`[getBySchool] IDs from user_roles: ${roleUserIds.length}`);

        // 2. Get teacher_ids from teacher_assignments (Fallback/Supplement)
        // This helps if a teacher is assigned but missing the role record
        let assignmentTeacherIds: string[] = [];
        if (roleName.toLowerCase() === 'teacher') {
          const { data: assignments, error: assignmentsError } = await supabase
            .from("teacher_assignments")
            .select("teacher_id")
            .eq("school_id", schoolId);
            
          if (!assignmentsError && assignments) {
             assignmentTeacherIds = assignments.map(a => a.teacher_id);
             console.log(`[getBySchool] IDs from teacher_assignments: ${assignmentTeacherIds.length}`);
          }
        }

        // 3. Merge IDs unique
        const uniqueUserIds = [...new Set([...roleUserIds, ...assignmentTeacherIds])];
        
        if (uniqueUserIds.length === 0) {
           console.warn('[getBySchool] No teachers found in known sources');
           return [];
        }

        const { data, error } = await supabase
          .from("users")
          .select("*")
          .in("id", uniqueUserIds)
          .order("first_name", { ascending: true })
          .order("last_name", { ascending: true });

        if (error) {
          console.error('[getBySchool] Users query error:', error);
          throw error;
        }
        
        console.log(`[getBySchool] Users found: ${data?.length || 0}`);
        return data ? snakeToCamelKeys(data) : [];
      } else {
        // No role filter, just get all users in the school
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
      }
    },
  }),

  // Update user
  update: () => ({
    mutationFn: async ({ id, ...update }: UserUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("users")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  }),

  // Delete user
  delete: () => ({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("users").delete().eq("id", id);

      if (error) throw error;
      return id;
    },
  }),

  // Create user account for existing student or parent (admin-initiated)
  createAccount: () => ({
    mutationFn: async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: "student" | "parent" | "teacher";
      schoolId: string;
      linkedStudentId?: string;
      linkedParentId?: string;
    }) => {
      const supabase = getSupabaseClient();

      console.log("🔐 Creating user account via API route:", input);

      // Get the current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Utilisateur non authentifié");
      }

      // Call the Next.js API route with access token
      const response = await fetch(
        `${window.location.origin}/api/users/create-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...input,
            accessToken, // Pass the access token for authentication
          }),
        },
      );

      let data;
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const errorMessage =
          data?.error || data?.message || `Erreur HTTP ${response.status}`;
        console.error("❌ API route error:", response.status, data);
        throw new Error(errorMessage);
      }

      console.log("✅ User account created successfully:", data);
      return data;
    },
  }),
};
