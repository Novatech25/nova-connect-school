import type { NovaConnectClient } from "../client";
import type { Database } from "../types";

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;

/**
 * RLS Helper Functions for secure multi-tenant queries
 * These functions help enforce Row Level Security policies
 */

/**
 * Adds school_id filter to a query for multi-tenant isolation
 * @param supabase - Supabase client instance
 * @param table - Table name to query
 * @param schoolId - School ID to filter by
 * @returns Query builder with school_id filter applied
 */
export const withSchoolFilter = <T extends TableName>(
  query: any,
  schoolId: string
) => {
  return query.eq('school_id', schoolId);
};

/**
 * Gets the current user's school_id
 * @param supabase - Supabase client instance
 * @returns School ID or null (null for super_admin)
 */
export const getCurrentUserSchoolId = async (
  supabase: NovaConnectClient
): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
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
};

/**
 * Checks if current user has a specific permission
 * @param supabase - Supabase client instance
 * @param resource - Resource to check (e.g., 'students', 'grades')
 * @param action - Action to check (e.g., 'create', 'read', 'update', 'delete')
 * @returns true if user has permission, false otherwise
 */
export const checkPermission = async (
  supabase: NovaConnectClient,
  resource: string,
  action: string
): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // Call the has_permission function from the database
  const { data, error } = await supabase
    .rpc('has_permission', {
      resource,
      action
    });

  if (error) {
    console.error('Error checking permission:', error);
    return false;
  }

  return data ?? false;
};

/**
 * Checks if current user is a super_admin
 * @param supabase - Supabase client instance
 * @returns true if user is super_admin, false otherwise
 */
export const isSuperAdmin = async (
  supabase: NovaConnectClient
): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // Call the is_super_admin function from the database
  const { data, error } = await supabase
    .rpc('is_super_admin');

  if (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }

  return data ?? false;
};

/**
 * Checks if current user is a school_admin
 * @param supabase - Supabase client instance
 * @returns true if user is school_admin, false otherwise
 */
export const isSchoolAdmin = async (
  supabase: NovaConnectClient
): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  // Call the is_school_admin function from the database
  const { data, error } = await supabase
    .rpc('is_school_admin');

  if (error) {
    console.error('Error checking school admin status:', error);
    return false;
  }

  return data ?? false;
};

/**
 * Gets all roles for the current user or a specific user
 * @param supabase - Supabase client instance
 * @param userId - Optional user ID (defaults to current user)
 * @returns Array of user roles with school context
 */
export const getUserRoles = async (
  supabase: NovaConnectClient,
  userId?: string
): Promise<Array<{
  role_id: string;
  role_name: string;
  school_id: string | null;
  assigned_at: string;
}>> => {
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId ?? user?.id;

  if (!targetUserId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      role_id,
      school_id,
      assigned_at,
      roles (
        name
      )
    `)
    .eq('user_id', targetUserId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((ur: any) => ({
    role_id: ur.role_id,
    role_name: ur.roles?.name,
    school_id: ur.school_id,
    assigned_at: ur.assigned_at,
  }));
};

/**
 * Gets the primary role for the current user
 * @param supabase - Supabase client instance
 * @returns Primary role or null
 */
export const getPrimaryRole = async (
  supabase: NovaConnectClient
): Promise<string | null> => {
  const roles = await getUserRoles(supabase);

  // Debug: Log all roles for the current user
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('🔍 [getPrimaryRole] User roles:', roles);
  }

  if (roles.length === 0) {
    console.warn('⚠️ [getPrimaryRole] No roles found for user');
    return null;
  }

  // Priority order:
  // 1. super_admin (highest priority - global access)
  // 2. school_admin
  // 3. accountant
  // 4. teacher
  // 5. supervisor
  // 6. student
  // 7. parent

  const rolesPriority = [
    'super_admin',
    'school_admin',
    'accountant',
    'teacher',
    'supervisor',
    'student',
    'parent'
  ];

  // Find the highest priority role
  for (const priorityRole of rolesPriority) {
    const foundRole = roles.find(r => r.role_name === priorityRole);
    if (foundRole) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log(`✅ [getPrimaryRole] Selected primary role: ${priorityRole}`);
      }
      return priorityRole;
    }
  }

  // Fallback: return the first role if none match the priority list
  const fallbackRole = roles[0].role_name;
  console.warn(`⚠️ [getPrimaryRole] No matching priority role, using fallback: ${fallbackRole}`);
  return fallbackRole;
};

/**
 * Ensures user has access to a specific school
 * @param supabase - Supabase client instance
 * @param schoolId - School ID to check access for
 * @returns true if user has access, false otherwise
 */
export const hasSchoolAccess = async (
  supabase: NovaConnectClient,
  schoolId: string
): Promise<boolean> => {
  const userSchoolId = await getCurrentUserSchoolId(supabase);

  // Super admin has access to all schools
  if (userSchoolId === null) {
    return await isSuperAdmin(supabase);
  }

  // User has access only to their own school
  return userSchoolId === schoolId;
};

/**
 * Applies school filter to query if user is not super_admin
 * @param supabase - Supabase client instance
 * @param query - Query builder to apply filter to
 * @returns Query builder with optional school filter
 */
export const applySchoolFilterIfNotSuperAdmin = async (
  supabase: NovaConnectClient,
  query: any
): Promise<any> => {
  const superAdmin = await isSuperAdmin(supabase);

  if (!superAdmin) {
    const schoolId = await getCurrentUserSchoolId(supabase);
    if (schoolId) {
      return query.eq('school_id', schoolId);
    }
  }

  return query;
};
