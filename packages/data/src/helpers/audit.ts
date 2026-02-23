import type { NovaConnectClient } from "../client";
import { getSupabaseClient } from "../client";

/**
 * Audit Log Helper Functions
 * These functions help log and retrieve audit information
 */

/**
 * Audit Log Parameters interface
 */
export interface AuditLogParams {
  action: "INSERT" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "EXPORT" | "VALIDATE";
  resourceType: string;
  resourceId?: string;
  oldData?: any;
  newData?: any;
  metadata?: Record<string, unknown>;
  userId?: string; // Optional: provide if already authenticated
  schoolId?: string; // Optional: provide if already known
}

/**
 * Generic audit log function for API routes
 * @param params - Audit log parameters
 * @returns void
 */
export const logAudit = async (params: AuditLogParams): Promise<void> => {
  try {
    const supabase = getSupabaseClient();

    let userId = params.userId;
    let schoolId = params.schoolId;

    // Only fetch user if not provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.warn("Cannot log audit: no authenticated user and no userId provided");
        return;
      }

      userId = user.id;
    }

    // Only fetch school_id if not provided
    if (!schoolId) {
      const { data: userData } = await supabase
        .from("users")
        .select("school_id")
        .eq("id", userId)
        .single();

      schoolId = userData?.school_id || null;
    }

    const { error } = await supabase
      .from("audit_logs")
      .insert({
        school_id: schoolId,
        user_id: userId,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        old_data: params.oldData,
        new_data: params.newData,
        metadata: params.metadata || {},
      });

    if (error) {
      console.error("Failed to log audit:", error);
    }
  } catch (error) {
    console.error("Error in logAudit:", error);
  }
};

/**
 * Logs a custom action to the audit log
 * @param supabase - Supabase client instance
 * @param action - Action type (LOGIN, LOGOUT, EXPORT, VALIDATE, etc.)
 * @param resourceType - Type of resource (e.g., 'students', 'grades')
 * @param resourceId - Optional ID of the resource
 * @param metadata - Optional metadata JSON
 * @returns The created audit log entry ID or null
 */
export const logAction = async (
  supabase: NovaConnectClient,
  action: 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'VALIDATE',
  resourceType: string,
  resourceId?: string,
  metadata: Record<string, any> = {}
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('log_custom_action', {
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_metadata: metadata,
    });

    if (error) {
      console.error('Error logging action:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in logAction:', error);
    return null;
  }
};

/**
 * Logs a user login event
 * @param supabase - Supabase client instance
 * @returns The audit log ID or null
 */
export const logLogin = async (
  supabase: NovaConnectClient
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('log_login');

    if (error) {
      console.error('Error logging login:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in logLogin:', error);
    return null;
  }
};

/**
 * Logs a user logout event
 * @param supabase - Supabase client instance
 * @returns The audit log ID or null
 */
export const logLogout = async (
  supabase: NovaConnectClient
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('log_logout');

    if (error) {
      console.error('Error logging logout:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in logLogout:', error);
    return null;
  }
};

/**
 * Logs a data export event
 * @param supabase - Supabase client instance
 * @param resourceType - Type of resource being exported
 * @param filters - Optional filters applied to export
 * @returns The audit log ID or null
 */
export const logExport = async (
  supabase: NovaConnectClient,
  resourceType: string,
  filters: Record<string, any> = {}
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('log_export', {
      p_resource_type: resourceType,
      p_filters: filters,
    });

    if (error) {
      console.error('Error logging export:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in logExport:', error);
    return null;
  }
};

/**
 * Logs a data validation event
 * @param supabase - Supabase client instance
 * @param resourceType - Type of resource being validated
 * @param resourceId - ID of the resource being validated
 * @param validationResult - Result of the validation
 * @returns The audit log ID or null
 */
export const logValidation = async (
  supabase: NovaConnectClient,
  resourceType: string,
  resourceId: string,
  validationResult: Record<string, any>
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('log_validation', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_validation_result: validationResult,
    });

    if (error) {
      console.error('Error logging validation:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in logValidation:', error);
    return null;
  }
};

/**
 * Alias for logAudit to match the API route naming
 */
export const createAuditLog = logAudit;

/**
 * Retrieves audit logs with optional filters
 * @param supabase - Supabase client instance
 * @param filters - Optional filters to apply
 * @returns Array of audit log entries
 */
export const getAuditLogs = async (
  supabase: NovaConnectClient,
  filters: {
    schoolId?: string;
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
) => {
  let query = supabase
    .from('audit_logs')
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
    query = query.gte('created_at', filters.startDate.toISOString());
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate.toISOString());
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
 * Gets audit logs for a specific resource
 * @param supabase - Supabase client instance
 * @param resourceType - Type of resource
 * @param resourceId - ID of the resource
 * @param limit - Maximum number of logs to retrieve
 * @returns Array of audit log entries for the resource
 */
export const getResourceAuditLogs = async (
  supabase: NovaConnectClient,
  resourceType: string,
  resourceId: string,
  limit = 50
) => {
  return getAuditLogs(supabase, {
    resourceType,
    resourceId,
    limit,
  });
};

/**
 * Gets audit logs for a specific user
 * @param supabase - Supabase client instance
 * @param userId - ID of the user
 * @param limit - Maximum number of logs to retrieve
 * @returns Array of audit log entries for the user
 */
export const getUserAuditLogs = async (
  supabase: NovaConnectClient,
  userId: string,
  limit = 50
) => {
  return getAuditLogs(supabase, {
    userId,
    limit,
  });
};

/**
 * Gets audit logs for a specific school
 * @param supabase - Supabase client instance
 * @param schoolId - ID of the school
 * @param filters - Additional filters
 * @returns Array of audit log entries for the school
 */
export const getSchoolAuditLogs = async (
  supabase: NovaConnectClient,
  schoolId: string,
  filters: Omit<Parameters<typeof getAuditLogs>[1], 'schoolId'> = {}
) => {
  return getAuditLogs(supabase, {
    schoolId,
    ...filters,
  });
};
