import { QueryClient } from "@tanstack/react-query";
import type { NovaConnectClient } from "../client";

/**
 * React Query hooks for Roles
 * Handles fetching, creating, updating, and deleting roles
 */

// Query keys factory
export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...roleKeys.lists(), filters] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  withPermissions: (id: string) => [...roleKeys.detail(id), 'permissions'] as const,
};

/**
 * Get all roles
 */
export const getAllRoles = async (supabase: NovaConnectClient) => {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Get role by ID
 */
export const getRoleById = async (supabase: NovaConnectClient, id: string) => {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Get role with permissions
 */
export const getRoleWithPermissions = async (supabase: NovaConnectClient, id: string) => {
  const { data, error } = await supabase
    .from('roles')
    .select(`
      *,
      role_permissions (
        permission_id,
        permissions (
          id,
          resource,
          action,
          description
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Create a new role (super_admin only)
 */
export const createRole = async (
  supabase: NovaConnectClient,
  role: {
    name: string;
    description?: string;
    is_system?: boolean;
  }
) => {
  const { data, error } = await supabase
    .from('roles')
    .insert(role)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Update a role
 */
export const updateRole = async (
  supabase: NovaConnectClient,
  id: string,
  updates: {
    name?: string;
    description?: string;
    is_system?: boolean;
  }
) => {
  const { data, error } = await supabase
    .from('roles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Delete a role
 */
export const deleteRole = async (supabase: NovaConnectClient, id: string) => {
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }

  return true;
};

/**
 * Role queries object for use with React Query
 */
export const roleQueries = {
  getAll: (supabase: NovaConnectClient) => ({
    queryKey: roleKeys.lists(),
    queryFn: () => getAllRoles(supabase),
  }),

  getById: (supabase: NovaConnectClient, id: string) => ({
    queryKey: roleKeys.detail(id),
    queryFn: () => getRoleById(supabase, id),
    enabled: !!id,
  }),

  getWithPermissions: (supabase: NovaConnectClient, id: string) => ({
    queryKey: roleKeys.withPermissions(id),
    queryFn: () => getRoleWithPermissions(supabase, id),
    enabled: !!id,
  }),
};
