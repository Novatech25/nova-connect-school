import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";
import { auditLogQueries } from "../queries/auditLogs";
import {
  logAction,
  logLogin,
  logLogout,
  logExport,
  logValidation,
} from "../helpers";

/**
 * React Hooks for Audit Logs
 * Handles fetching audit logs and logging custom actions
 */

/**
 * Hook to get audit logs with optional filters
 */
export const useAuditLogs = (
  filters?: Parameters<typeof auditLogQueries.getAll>[1]
) => {
  const supabase = getSupabaseClient();

  return useQuery({
    ...auditLogQueries.getAll(supabase, filters),
  });
};

/**
 * Hook to get audit logs for a specific school
 */
export const useSchoolAuditLogs = (
  schoolId: string,
  filters?: Omit<Parameters<typeof auditLogQueries.getBySchool>[2], 'schoolId'>
) => {
  const supabase = getSupabaseClient();

  return useQuery({
    ...auditLogQueries.getBySchool(supabase, schoolId, filters),
    enabled: !!schoolId,
  });
};

/**
 * Hook to get audit logs for a specific user
 */
export const useUserAuditLogs = (
  userId: string,
  filters?: Omit<Parameters<typeof auditLogQueries.getByUser>[2], 'userId'>
) => {
  const supabase = getSupabaseClient();

  return useQuery({
    ...auditLogQueries.getByUser(supabase, userId, filters),
    enabled: !!userId,
  });
};

/**
 * Hook to get audit logs for a specific resource
 */
export const useResourceAuditLogs = (
  resourceType: string,
  resourceId: string,
  filters?: Omit<Parameters<typeof auditLogQueries.getByResource>[3], 'resourceType' | 'resourceId'>
) => {
  const supabase = getSupabaseClient();

  return useQuery({
    ...auditLogQueries.getByResource(supabase, resourceType, resourceId, filters),
    enabled: !!resourceType && !!resourceId,
  });
};

/**
 * Hook to get recent audit logs (last 7 days)
 */
export const useRecentAuditLogs = (schoolId?: string, limit = 50) => {
  const supabase = getSupabaseClient();

  return useQuery({
    ...auditLogQueries.getRecent(supabase, schoolId, limit),
  });
};

/**
 * Hook to get audit log statistics
 */
export const useAuditLogStats = (
  filters?: Parameters<typeof auditLogQueries.getStats>[1]
) => {
  const supabase = getSupabaseClient();

  return useQuery({
    ...auditLogQueries.getStats(supabase, filters),
  });
};

/**
 * Mutation to log a custom action
 */
export const useLogAction = () => {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      action: 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'VALIDATE';
      resourceType: string;
      resourceId?: string;
      metadata?: Record<string, any>;
    }) => {
      return logAction(
        supabase,
        params.action,
        params.resourceType,
        params.resourceId,
        params.metadata
      );
    },
    onSuccess: () => {
      // Invalidate audit logs queries to refetch
      queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
};

/**
 * Mutation to log a login event
 */
export const useLogLogin = () => {
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: () => logLogin(supabase),
  });
};

/**
 * Mutation to log a logout event
 */
export const useLogLogout = () => {
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: () => logLogout(supabase),
  });
};

/**
 * Mutation to log an export event
 */
export const useLogExport = () => {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      resourceType: string;
      filters?: Record<string, any>;
    }) => {
      return logExport(supabase, params.resourceType, params.filters);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
};

/**
 * Mutation to log a validation event
 */
export const useLogValidation = () => {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      resourceType: string;
      resourceId: string;
      validationResult: Record<string, any>;
    }) => {
      return logValidation(
        supabase,
        params.resourceType,
        params.resourceId,
        params.validationResult
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
};
