import { useQuery } from "@tanstack/react-query";
import { statisticsQueries } from "../queries/statistics";

export function useGlobalStats() {
  const stats = useQuery({
    ...statisticsQueries.getGlobalStats(),
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  return {
    stats: stats.data,
    isLoading: stats.isLoading,
    error: stats.error,
  };
}

export function useSchoolStats(schoolId: string) {
  const stats = useQuery({
    ...statisticsQueries.getSchoolStats(schoolId),
    enabled: !!schoolId,
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  return {
    stats: stats.data,
    isLoading: stats.isLoading,
    error: stats.error,
  };
}

export function useRecentActivity() {
  const activity = useQuery({
    ...statisticsQueries.getRecentActivity(),
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    activity: activity.data,
    isLoading: activity.isLoading,
    error: activity.error,
  };
}

export function useAlerts() {
  const alerts = useQuery({
    ...statisticsQueries.getAlerts(),
    refetchInterval: 120000, // Refetch every 2 minutes
  });

  return {
    alerts: alerts.data,
    isLoading: alerts.isLoading,
    error: alerts.error,
  };
}
