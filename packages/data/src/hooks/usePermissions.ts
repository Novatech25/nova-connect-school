import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";
import { checkPermission as checkPermissionHelper } from "../helpers";

/**
 * React Hooks for Permissions
 * Handles permission checks and caching
 */

/**
 * Hook to get all permissions for the current user
 */
export const usePermissions = () => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['permissions', 'mine'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          roles (
            role_permissions (
              permissions (
                resource,
                action,
                description
              )
            )
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      // Extract unique permissions
      const permissionsSet = new Set<string>();
      const permissions: Array<{ resource: string; action: string; description: string }> = [];

      data?.forEach((ur: any) => {
        ur.roles?.role_permissions?.forEach((rp: any) => {
          const perm = rp.permissions;
          if (perm) {
            const key = `${perm.resource}:${perm.action}`;
            if (!permissionsSet.has(key)) {
              permissionsSet.add(key);
              permissions.push(perm);
            }
          }
        });
      });

      return permissions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to check if current user has a specific permission
 */
/**
 * Hook to check if current user has a specific permission
 */
export const useFetchHasPermission = (resource: string, action: string) => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['permissions', 'check', resource, action],
    queryFn: () => checkPermissionHelper(supabase, resource, action),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to check if current user can access a resource with a specific action
 * Alias for useFetchHasPermission
 */
export const useCanAccess = (resource: string, action: string) => {
  return useFetchHasPermission(resource, action);
};

/**
 * Hook to check multiple permissions at once
 */
export const useHasPermissions = (
  permissions: Array<{ resource: string; action: string }>
) => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['permissions', 'checkMultiple', permissions],
    queryFn: async () => {
      const results = await Promise.all(
        permissions.map(({ resource, action }) =>
          checkPermissionHelper(supabase, resource, action)
        )
      );

      return permissions.map((perm, index) => ({
        ...perm,
        hasPermission: results[index],
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to get permissions grouped by resource
 */
export const usePermissionsByResource = () => {
  const { data: permissions, ...rest } = usePermissions();

  const grouped = permissions?.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm.action);
    return acc;
  }, {} as Record<string, string[]>);

  return {
    ...rest,
    data: grouped,
  };
};
