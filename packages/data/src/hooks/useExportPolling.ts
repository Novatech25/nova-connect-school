'use client';

// ============================================
// Module Premium - API Export Avancé
// Custom Hook: Export Polling
// ============================================

import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { exportJobQueries } from "../queries/exports";
import type { ExportJob, ExportStatus } from "@repo/core/types";

interface UseExportPollingOptions {
  jobIds: string[];
  pollInterval?: number; // milliseconds
  onJobComplete?: (job: ExportJob) => void;
  onJobFailed?: (job: ExportJob) => void;
  enabled?: boolean;
}

interface PollingStatus {
  activeJobs: ExportJob[];
  completedJobs: ExportJob[];
  failedJobs: ExportJob[];
  isPolling: boolean;
}

/**
 * Hook to poll multiple export jobs for status updates
 * Automatically stops when all jobs are completed or failed
 */
export function useExportPolling(options: UseExportPollingOptions) {
  const {
    jobIds,
    pollInterval = 3000,
    onJobComplete,
    onJobFailed,
    enabled = true,
  } = options;

  const [pollingStatus, setPollingStatus] = useState<PollingStatus>({
    activeJobs: [],
    completedJobs: [],
    failedJobs: [],
    isPolling: false,
  });

  const queryClient = useQueryClient();
  const completedJobIds = useRef<Set<string>>(new Set());
  const failedJobIds = useRef<Set<string>>(new Set());

  // Query for all jobs
  const jobsQuery = useQuery({
    queryKey: ["export_jobs", "poll", jobIds],
    queryFn: async () => {
      if (jobIds.length === 0) return [];

      const jobs = await Promise.all(
        jobIds.map(async (id) => {
          try {
            const result = await queryClient.fetchQuery({
              ...exportJobQueries.getById(id),
            });
            return result;
          } catch (error) {
            console.error(`Error polling job ${id}:`, error);
            return null;
          }
        })
      );

      return jobs.filter((job): job is ExportJob => job !== null);
    },
    enabled: enabled && jobIds.length > 0,
    refetchInterval: enabled && jobIds.length > 0 ? pollInterval : false,
  });

  // Process job status changes
  useEffect(() => {
    if (!jobsQuery.data) return;

    const jobs = jobsQuery.data;
    const active: ExportJob[] = [];
    const newlyCompleted: ExportJob[] = [];
    const newlyFailed: ExportJob[] = [];

    jobs.forEach((job) => {
      const jobId = job.id;

      if (job.status === "completed") {
        if (!completedJobIds.current.has(jobId)) {
          completedJobIds.current.add(jobId);
          newlyCompleted.push(job);
          onJobComplete?.(job);
        }
      } else if (job.status === "failed") {
        if (!failedJobIds.current.has(jobId)) {
          failedJobIds.current.add(jobId);
          newlyFailed.push(job);
          onJobFailed?.(job);
        }
      } else if (job.status === "pending" || job.status === "processing") {
        active.push(job);
      }
    });

    // Only update status if there are changes
    if (
      newlyCompleted.length > 0 ||
      newlyFailed.length > 0 ||
      active.length !== pollingStatus.activeJobs.length
    ) {
      setPollingStatus({
        activeJobs: active,
        completedJobs: [
          ...pollingStatus.completedJobs,
          ...newlyCompleted,
        ],
        failedJobs: [
          ...pollingStatus.failedJobs,
          ...newlyFailed,
        ],
        isPolling: active.length > 0,
      });
    }
  }, [jobsQuery.data]);

  // Reset when jobIds change
  useEffect(() => {
    completedJobIds.current = new Set();
    failedJobIds.current = new Set();
    setPollingStatus({
      activeJobs: [],
      completedJobs: [],
      failedJobs: [],
      isPolling: jobIds.length > 0,
    });
  }, [JSON.stringify(jobIds)]);

  return {
    ...pollingStatus,
    isLoading: jobsQuery.isLoading,
    error: jobsQuery.error,
  };
}

/**
 * Hook to poll a single export job
 */
export function useSingleExportPolling(
  jobId: string,
  options?: {
    pollInterval?: number;
    onComplete?: (job: ExportJob) => void;
    onFailed?: (job: ExportJob) => void;
    enabled?: boolean;
  }
) {
  const query = useQuery({
    ...exportJobQueries.getById(jobId),
    enabled: !!jobId && (options?.enabled !== false),
    refetchInterval: (data) => {
      // Stop polling when completed or failed
      if (!data || data.status === "completed" || data.status === "failed") {
        return false;
      }
      return options?.pollInterval || 3000;
    },
  });

  // Trigger callbacks on status change
  useEffect(() => {
    if (!query.data) return;

    if (query.data.status === "completed" && options?.onComplete) {
      options.onComplete(query.data);
    } else if (query.data.status === "failed" && options?.onFailed) {
      options.onFailed(query.data);
    }
  }, [query.data?.status]);

  return {
    job: query.data,
    status: query.data?.status,
    isLoading: query.isLoading,
    error: query.error,
    isPolling: query.data?.status === "pending" || query.data?.status === "processing",
  };
}

/**
 * Hook to get active exports for a school (for dashboard notifications)
 */
export function useActiveExports(schoolId: string) {
  return useQuery({
    ...exportJobQueries.getByStatus(schoolId, ["pending", "processing"]),
    enabled: !!schoolId,
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

/**
 * Hook to get export statistics for a school
 */
export function useExportStatistics(schoolId: string) {
  return useQuery({
    ...exportStatisticsQueries.getForSchool(schoolId),
    enabled: !!schoolId,
  });
}

// Import the statistics queries
import { exportStatisticsQueries } from "../queries/exports";
