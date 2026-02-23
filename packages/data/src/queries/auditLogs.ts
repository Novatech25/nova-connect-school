import type { NovaConnectClient } from "../client";

/**
 * React Query hooks for Audit Logs
 * Handles fetching and filtering audit logs
 */

// Query keys factory
export const auditLogKeys = {
  all: ['audit_logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...auditLogKeys.lists(), filters] as const,
  details: () => [...auditLogKeys.all, 'detail'] as const,
  detail: (id: string) => [...auditLogKeys.details(), id] as const,
  bySchool: (schoolId: string) => ['audit_logs', 'bySchool', schoolId] as const,
  byUser: (userId: string) => ['audit_logs', 'byUser', userId] as const,
  byResource: (resourceType: string, resourceId: string) =>
    ['audit_logs', 'byResource', resourceType, resourceId] as const,
};

/**
 * Get audit logs with filters
 */
/**
 * Get audit logs with filters
 */
export const fetchAuditLogs = async (
  supabase: NovaConnectClient,
  filters: {
    schoolId?: string;
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}
) => {
  let query = supabase
    .from('audit_logs')
    // ... (reste de la fonction identique, juste le nom change)
    // Je dois inclure tout le corps pour replace_file_content si je remplace le bloc
    .select(`
      *,
      users (
        email,
        first_name,
        last_name
      ),
      schools (
        name,
        code
      )
    `)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.schoolId) {
    query = query.eq('school_id', filters.schoolId);
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.resourceType) {
    query = query.eq('resource_type', filters.resourceType);
  }

  if (filters.resourceId) {
    query = query.eq('resource_id', filters.resourceId);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Get audit logs for a specific school
 */
export const fetchSchoolAuditLogs = async (
  supabase: NovaConnectClient,
  schoolId: string,
  filters: Omit<Parameters<typeof fetchAuditLogs>[1], 'schoolId'> = {}
) => {
  return fetchAuditLogs(supabase, {
    schoolId,
    ...filters,
  });
};

/**
 * Get audit logs for a specific user
 */
export const fetchUserAuditLogs = async (
  supabase: NovaConnectClient,
  userId: string,
  filters: Omit<Parameters<typeof fetchAuditLogs>[1], 'userId'> = {}
) => {
  return fetchAuditLogs(supabase, {
    userId,
    ...filters,
  });
};

/**
 * Get audit logs for a specific resource
 */
export const fetchResourceAuditLogs = async (
  supabase: NovaConnectClient,
  resourceType: string,
  resourceId: string,
  filters: Omit<Parameters<typeof fetchAuditLogs>[1], 'resourceType' | 'resourceId'> = {}
) => {
  return fetchAuditLogs(supabase, {
    resourceType,
    resourceId,
    ...filters,
  });
};

/**
 * Get audit log statistics
 */
export const fetchAuditLogStats = async (
  supabase: NovaConnectClient,
  filters: {
    schoolId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  } = {}
) => {
  // Get all logs with filters
  const logs = await fetchAuditLogs(supabase, {
    ...filters,
    limit: 1000, // Increase limit for stats
  });

  // Calculate statistics
  const stats = {
    total: logs.length,
    byAction: logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byResourceType: logs.reduce((acc, log) => {
      acc[log.resource_type] = (acc[log.resource_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byUser: logs.reduce((acc, log) => {
      if (log.user_id) {
        acc[log.user_id] = (acc[log.user_id] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>),
  };

  return stats;
};

/**
 * Get recent audit logs (last 7 days)
 */
export const fetchRecentAuditLogs = async (
  supabase: NovaConnectClient,
  schoolId?: string,
  limit = 50
) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return fetchAuditLogs(supabase, {
    schoolId,
    startDate: sevenDaysAgo.toISOString(),
    limit,
  });
};

/**
 * Audit log queries object for use with React Query
 */
export const auditLogQueries = {
  getAll: (supabase: NovaConnectClient, filters?: Parameters<typeof fetchAuditLogs>[1]) => ({
    queryKey: auditLogKeys.list(filters),
    queryFn: () => fetchAuditLogs(supabase, filters),
  }),

  getBySchool: (supabase: NovaConnectClient, schoolId: string, filters?: Omit<Parameters<typeof fetchAuditLogs>[1], 'schoolId'>) => ({
    queryKey: auditLogKeys.bySchool(schoolId),
    queryFn: () => fetchSchoolAuditLogs(supabase, schoolId, filters),
    enabled: !!schoolId,
  }),

  getByUser: (supabase: NovaConnectClient, userId: string, filters?: Omit<Parameters<typeof fetchAuditLogs>[1], 'userId'>) => ({
    queryKey: auditLogKeys.byUser(userId),
    queryFn: () => fetchUserAuditLogs(supabase, userId, filters),
    enabled: !!userId,
  }),

  getByResource: (supabase: NovaConnectClient, resourceType: string, resourceId: string, filters?: Omit<Parameters<typeof fetchAuditLogs>[1], 'resourceType' | 'resourceId'>) => ({
    queryKey: auditLogKeys.byResource(resourceType, resourceId),
    queryFn: () => fetchResourceAuditLogs(supabase, resourceType, resourceId, filters),
    enabled: !!resourceType && !!resourceId,
  }),

  getStats: (supabase: NovaConnectClient, filters?: Parameters<typeof fetchAuditLogStats>[1]) => ({
    queryKey: [...auditLogKeys.all, 'stats', filters],
    queryFn: () => fetchAuditLogStats(supabase, filters),
  }),

  getRecent: (supabase: NovaConnectClient, schoolId?: string, limit = 50) => ({
    queryKey: [...auditLogKeys.lists(), { recent: true, schoolId, limit }],
    queryFn: () => fetchRecentAuditLogs(supabase, schoolId, limit),
  }),
};
