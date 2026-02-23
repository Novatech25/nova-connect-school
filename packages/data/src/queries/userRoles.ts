import type { NovaConnectClient } from "../client";

/**
 * React Query hooks for User Roles
 * Handles fetching, assigning, and revoking user roles
 */

// Query keys factory
export const userRoleKeys = {
  all: ['user_roles'] as const,
  lists: () => [...userRoleKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...userRoleKeys.lists(), filters] as const,
  details: () => [...userRoleKeys.all, 'detail'] as const,
  byUser: (userId: string) => ['user_roles', 'byUser', userId] as const,
  bySchool: (schoolId: string) => ['user_roles', 'bySchool', schoolId] as const,
};

/**
 * Get all roles for a user
 */
/**
 * Get all roles for a user
 */
export const fetchUserRoles = async (
  supabase: NovaConnectClient,
  userId: string
) => {
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      *,
      roles (
        id,
        name,
        description,
        is_system
      ),
      schools (
        id,
        name,
        code
      )
    `)
    .eq('user_id', userId)
    .order('assigned_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Get all users with a specific role in a school
 */
export const getUsersByRole = async (
  supabase: NovaConnectClient,
  roleId: string,
  schoolId?: string
) => {
  let query = supabase
    .from('user_roles')
    .select(`
      *,
      users (
        id,
        email,
        first_name,
        last_name,
        avatar_url,
        is_active
      ),
      schools (
        id,
        name,
        code
      )
    `)
    .eq('role_id', roleId);

  if (schoolId) {
    query = query.eq('school_id', schoolId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Assign a role to a user
 */
export const assignRoleToUser = async (
  supabase: NovaConnectClient,
  userId: string,
  roleId: string,
  schoolId: string | null,
  assignedBy?: string
) => {
  const { data, error } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role_id: roleId,
      school_id: schoolId,
      assigned_by: assignedBy,
    })
    .select(`
      *,
      roles (
        id,
        name,
        description
      )
    `)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Revoke a role from a user
 */
export const revokeRoleFromUser = async (
  supabase: NovaConnectClient,
  userId: string,
  roleId: string,
  schoolId: string | null
) => {
  let query = supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', roleId);

  if (schoolId) {
    query = query.eq('school_id', schoolId);
  } else {
    query = query.is('school_id', null);
  }

  const { error } = await query;

  if (error) {
    throw error;
  }

  return true;
};

/**
 * Update user's role assignment
 */
export const updateUserRole = async (
  supabase: NovaConnectClient,
  userRoleId: string,
  updates: {
    role_id?: string;
    school_id?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from('user_roles')
    .update(updates)
    .eq('id', userRoleId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Get all users in a school with their roles
 */
export const getSchoolUsersWithRoles = async (
  supabase: NovaConnectClient,
  schoolId: string
) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      user_roles (
        role_id,
        school_id,
        assigned_at,
        roles (
          id,
          name,
          description
        )
      )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * User role queries object for use with React Query
 */
export const userRoleQueries = {
  getByUser: (supabase: NovaConnectClient, userId: string) => ({
    queryKey: userRoleKeys.byUser(userId),
    queryFn: () => fetchUserRoles(supabase, userId),
    enabled: !!userId,
  }),

  getByRole: (supabase: NovaConnectClient, roleId: string, schoolId?: string) => ({
    queryKey: [...userRoleKeys.lists(), { roleId, schoolId }],
    queryFn: () => getUsersByRole(supabase, roleId, schoolId),
    enabled: !!roleId,
  }),

  getSchoolUsers: (supabase: NovaConnectClient, schoolId: string) => ({
    queryKey: userRoleKeys.bySchool(schoolId),
    queryFn: () => getSchoolUsersWithRoles(supabase, schoolId),
    enabled: !!schoolId,
  }),
};
