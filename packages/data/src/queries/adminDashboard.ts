import { getSupabaseClient } from '../client';

const supabase = getSupabaseClient();

export interface AdminDashboardStats {
  activeStudents: number;
  teachers: number;
  openClasses: number;
  pendingPayments: number;
}

export interface AdminQuickOverview {
  pendingExports: number;
  attendanceConflicts: number;
}

export const adminDashboardQueries = {
  /**
   * Get dashboard stats for a school admin.
   * Runs 4 optimised count queries in parallel.
   */
  getStats: (schoolId: string) => ({
    queryKey: ['admin-dashboard-stats', schoolId],
    queryFn: async (): Promise<AdminDashboardStats> => {
      const [studentsRes, teachersRes, classesRes, pendingPaymentsRes] =
        await Promise.all([
          // 1. Active students count
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('status', 'active'),

          // 2. Teachers count - Fix: use user_roles table as users table has no role column
          supabase
            .from('user_roles')
            .select('id, roles!inner(name)', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('roles.name', 'teacher'),

          // 3. Open classes count (current academic year)
          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId),

          // 4. Pending Mobile Money payments (success but not reconciled)
          supabase
            .from('mobile_money_transactions')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('status', 'success')
            .eq('reconciliation_status', 'pending'),
        ]);

      return {
        activeStudents: studentsRes.count ?? 0,
        teachers: teachersRes.count ?? 0,
        openClasses: classesRes.count ?? 0,
        pendingPayments: pendingPaymentsRes.count ?? 0,
      };
    },
  }),

  /**
   * Get quick overview panel data for the admin dashboard.
   */
  getQuickOverview: (schoolId: string) => ({
    queryKey: ['admin-dashboard-overview', schoolId],
    queryFn: async (): Promise<AdminQuickOverview> => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [exportsRes, conflictsRes] = await Promise.all([
        // Pending / processing exports
        supabase
          .from('export_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .in('status', ['pending', 'processing']),

        // Attendance conflicts (overridden records in the last 7 days)
        supabase
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId)
          .eq('record_status', 'overridden')
          .gte('created_at', sevenDaysAgo.toISOString()),
      ]);

      return {
        pendingExports: exportsRes.count ?? 0,
        attendanceConflicts: conflictsRes.count ?? 0,
      };
    },
  }),
};
