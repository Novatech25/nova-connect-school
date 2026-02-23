import { useQuery } from '@tanstack/react-query';
import { accountantDashboardQueries, type AccountantDashboardStats } from '../queries/accountantDashboard';

// ============================================================================
// ACCOUNTANT DASHBOARD HOOKS
// ============================================================================

/**
 * Hook to fetch monthly collections (total payments this month)
 */
export function useMonthlyCollections(schoolId: string) {
  return useQuery({
    queryKey: ['accountant', 'monthly-collections', schoolId],
    queryFn: () => accountantDashboardQueries.getMonthlyCollections(schoolId),
    enabled: !!schoolId,
  });
}

/**
 * Hook to fetch total arrears (unpaid fee schedules)
 */
export function useTotalArrears(schoolId: string) {
  return useQuery({
    queryKey: ['accountant', 'total-arrears', schoolId],
    queryFn: () => accountantDashboardQueries.getTotalArrears(schoolId),
    enabled: !!schoolId,
  });
}

/**
 * Hook to fetch pending salaries (unpaid payroll for current month)
 */
export function usePendingSalaries(schoolId: string) {
  return useQuery({
    queryKey: ['accountant', 'pending-salaries', schoolId],
    queryFn: () => accountantDashboardQueries.getPendingSalaries(schoolId),
    enabled: !!schoolId,
  });
}

/**
 * Hook to fetch monthly transaction count
 */
export function useMonthlyTransactions(schoolId: string) {
  return useQuery({
    queryKey: ['accountant', 'monthly-transactions', schoolId],
    queryFn: () => accountantDashboardQueries.getMonthlyTransactions(schoolId),
    enabled: !!schoolId,
  });
}

/**
 * Hook to fetch all accountant dashboard stats at once
 */
export function useAccountantDashboardStats(schoolId: string) {
  return useQuery({
    queryKey: ['accountant', 'dashboard-stats', schoolId],
    queryFn: () => accountantDashboardQueries.getDashboardStats(schoolId),
    enabled: !!schoolId,
  });
}
