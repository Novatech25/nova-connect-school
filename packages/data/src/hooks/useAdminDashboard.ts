import { useQuery } from '@tanstack/react-query';
import { adminDashboardQueries } from '../queries/adminDashboard';

/**
 * Hook for the school admin dashboard.
 * Returns real-time stats and quick overview data for the current school.
 */
export function useAdminDashboardStats(schoolId: string | undefined | null) {
  const statsQuery = useQuery({
    ...adminDashboardQueries.getStats(schoolId!),
    enabled: !!schoolId,
    refetchInterval: 300_000, // Refresh every 5 minutes
  });

  const overviewQuery = useQuery({
    ...adminDashboardQueries.getQuickOverview(schoolId!),
    enabled: !!schoolId,
    refetchInterval: 300_000,
  });

  return {
    stats: statsQuery.data ?? null,
    overview: overviewQuery.data ?? null,
    isLoading: statsQuery.isLoading || overviewQuery.isLoading,
    error: statsQuery.error || overviewQuery.error,
  };
}
