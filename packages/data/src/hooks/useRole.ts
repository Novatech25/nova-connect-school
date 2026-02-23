import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";
import { isSuperAdmin, isSchoolAdmin, getPrimaryRole, getUserRoles } from "../helpers";

/**
 * React Hooks for User Roles
 * Handles role checks and user role information
 */

/**
 * Hook to get the primary role of the current user
 */
export const useRole = () => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['user', 'role', 'primary'],
    queryFn: () => getPrimaryRole(supabase),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to get all roles of the current user
 */
export const useRoles = () => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['user', 'roles'],
    queryFn: () => getUserRoles(supabase),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to check if current user is a super admin
 */
export const useIsSuperAdmin = () => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['user', 'isSuperAdmin'],
    queryFn: () => isSuperAdmin(supabase),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to check if current user is a school admin
 */
export const useIsSchoolAdmin = () => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['user', 'isSchoolAdmin'],
    queryFn: () => isSchoolAdmin(supabase),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to check if current user has a specific role
 */
export const useFetchHasRole = (roleName: string) => {
  const { data: roles, ...rest } = useRoles();

  const hasRole = roles?.some(role => role.role_name === roleName) ?? false;

  return {
    ...rest,
    data: hasRole,
  };
};

/**
 * Hook to get all roles for a specific user (admin only)
 */
export const useUserRoles = (userId: string) => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['users', userId, 'roles'],
    queryFn: () => getUserRoles(supabase, userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to get current user's school ID
 */
export const useUserSchoolId = () => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['user', 'schoolId'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      const { data, error } = await supabase
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      return data?.school_id ?? null;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
