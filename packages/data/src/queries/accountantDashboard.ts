import { getSupabaseClient } from '../client';

const supabase = getSupabaseClient();

// ============================================================================
// ACCOUNTANT DASHBOARD STATS
// ============================================================================

export interface AccountantDashboardStats {
  monthlyCollections: number;
  totalArrears: number;
  pendingSalaries: number;
  monthlyTransactions: number;
}

export const accountantDashboardQueries = {
  /**
   * Get monthly collections (total payments received this month)
   */
  async getMonthlyCollections(schoolId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_monthly_collections_rpc', {
        p_school_id: schoolId
      });

    if (error) {
      console.error('Error fetching monthly collections:', error);
      throw error;
    }
    
    return data || 0;
  },

  /**
   * Get total arrears (unpaid fee schedules)
   */
  async getTotalArrears(schoolId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_total_arrears_rpc', {
        p_school_id: schoolId
      });

    if (error) {
      console.error('Error fetching total arrears:', error);
      throw error;
    }
    
    return data || 0;
  },

  /**
   * Get pending salaries (total unpaid payroll for current month)
   */
  async getPendingSalaries(schoolId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_pending_salaries_rpc', {
        p_school_id: schoolId
      });

    if (error) {
      console.error('Error fetching pending salaries:', error);
      throw error;
    }
    
    return data || 0;
  },

  /**
   * Get monthly transaction count
   */
  async getMonthlyTransactions(schoolId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_monthly_transactions_count_rpc', {
        p_school_id: schoolId
      });

    if (error) {
      console.error('Error fetching monthly transactions:', error);
      throw error;
    }
    
    return data || 0;
  },

  /**
   * Get all dashboard stats at once
   */
  async getDashboardStats(schoolId: string): Promise<AccountantDashboardStats> {
    const { data, error } = await supabase
      .rpc('get_accountant_dashboard_stats_rpc', {
        p_school_id: schoolId
      });

    if (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }

    return {
      monthlyCollections: data?.monthlyCollections || 0,
      totalArrears: data?.totalArrears || 0,
      pendingSalaries: data?.pendingSalaries || 0,
      monthlyTransactions: data?.monthlyTransactions || 0,
    };
  },
};
