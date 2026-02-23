import { getSupabaseClient } from '../client';
import { snakeToCamelKeys } from '../helpers/transform';
import type { DocumentAccessLog, DocumentAccessFilters } from '@novaconnect/core';

export const documentAccessLogQueries = {
  /**
   * Get all document access logs with filters
   */
  getAll: (schoolId: string, filters?: DocumentAccessFilters) => ({
    queryKey: ['document_access_logs', schoolId, filters],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('document_access_logs')
        .select(`
          *,
          user:users(id, first_name, last_name),
          student:students(id, first_name, last_name, matricule)
        `)
        .eq('school_id', schoolId)
        .order('accessed_at', { ascending: false })
        .limit(100);

      if (filters?.studentId) query = query.eq('student_id', filters.studentId);
      if (filters?.documentType) query = query.eq('document_type', filters.documentType);
      if (filters?.accessGranted !== undefined) query = query.eq('access_granted', filters.accessGranted);
      if (filters?.dateFrom) query = query.gte('accessed_at', filters.dateFrom.toISOString());
      if (filters?.dateTo) query = query.lte('accessed_at', filters.dateTo.toISOString());

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data) as DocumentAccessLog[];
    },
  }),

  /**
   * Get blocked access attempts (for admin dashboard)
   */
  getBlockedAttempts: (schoolId: string) => ({
    queryKey: ['document_access_logs', 'blocked', schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('document_access_logs')
        .select(`
          *,
          user:users(id, first_name, last_name),
          student:students(id, first_name, last_name, matricule)
        `)
        .eq('school_id', schoolId)
        .eq('access_granted', false)
        .order('accessed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return snakeToCamelKeys(data) as DocumentAccessLog[];
    },
  }),

  /**
   * Get access stats for dashboard
   */
  getStats: (schoolId: string) => ({
    queryKey: ['document_access_logs', 'stats', schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();

      // Get counts
      const { count: totalAttempts } = await supabase
        .from('document_access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId);

      const { count: blockedAttempts } = await supabase
        .from('document_access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('access_granted', false);

      const { count: overriddenAccess } = await supabase
        .from('document_access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('payment_status_override', true);

      return {
        totalAttempts: totalAttempts || 0,
        blockedAttempts: blockedAttempts || 0,
        overriddenAccess: overriddenAccess || 0,
        successRate: totalAttempts ? ((totalAttempts - (blockedAttempts || 0)) / totalAttempts) * 100 : 100,
      };
    },
  }),
};
