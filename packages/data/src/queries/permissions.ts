import type { NovaConnectClient } from "../client";

/**
 * React Query hooks for Permissions
 * Handles fetching, assigning, and removing permissions
 */

// Query keys factory
export const permissionKeys = {
  all: ['permissions'] as const,
  lists: () => [...permissionKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...permissionKeys.lists(), filters] as const,
  details: () => [...permissionKeys.all, 'detail'] as const,
  detail: (id: string) => [...permissionKeys.details(), id] as const,
  byRole: (roleId: string) => ['permissions', 'byRole', roleId] as const,
};

/**
 * Get all permissions
 */
export const getAllPermissions = async (supabase: NovaConnectClient) => {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('resource', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Get permissions grouped by resource
 */
export const getPermissionsByResource = async (supabase: NovaConnectClient) => {
  const permissions = await getAllPermissions(supabase);

  // Group by resource
  const grouped = permissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {} as Record<string, typeof permissions>);

  return grouped;
};

/**
 * Get permissions for a specific role
 */
export const getPermissionsByRole = async (
  supabase: NovaConnectClient,
  roleId: string
) => {
  const { data, error } = await supabase
    .from('role_permissions')
    .select(`
      permission_id,
      permissions (
        id,
        resource,
        action,
        description
      )
    `)
    .eq('role_id', roleId);

  if (error) {
    throw error;
  }

  return data?.map(rp => rp.permissions).filter(Boolean);
};

/**
 * Assign a permission to a role
 */
export const assignPermissionToRole = async (
  supabase: NovaConnectClient,
  roleId: string,
  permissionId: string
) => {
  const { data, error } = await supabase
    .from('role_permissions')
    .insert({
      role_id: roleId,
      permission_id: permissionId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Remove a permission from a role
 */
export const removePermissionFromRole = async (
  supabase: NovaConnectClient,
  roleId: string,
  permissionId: string
) => {
  const { error } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId)
    .eq('permission_id', permissionId);

  if (error) {
    throw error;
  }

  return true;
};

/**
 * Bulk assign permissions to a role
 */
export const assignPermissionsToRole = async (
  supabase: NovaConnectClient,
  roleId: string,
  permissionIds: string[]
) => {
  const { data, error } = await supabase
    .from('role_permissions')
    .insert(
      permissionIds.map(permissionId => ({
        role_id: roleId,
        permission_id: permissionId,
      }))
    )
    .select();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Bulk remove permissions from a role
 */
export const removeAllPermissionsFromRole = async (
  supabase: NovaConnectClient,
  roleId: string
) => {
  const { error } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId);

  if (error) {
    throw error;
  }

  return true;
};

/**
 * Permission queries object for use with React Query
 */
export const permissionQueries = {
  getAll: (supabase: NovaConnectClient) => ({
    queryKey: permissionKeys.lists(),
    queryFn: () => getAllPermissions(supabase),
  }),

  getByResource: (supabase: NovaConnectClient) => ({
    queryKey: permissionKeys.list({ grouped: true }),
    queryFn: () => getPermissionsByResource(supabase),
  }),

  getByRole: (supabase: NovaConnectClient, roleId: string) => ({
    queryKey: permissionKeys.byRole(roleId),
    queryFn: () => getPermissionsByRole(supabase, roleId),
    enabled: !!roleId,
  }),
};
