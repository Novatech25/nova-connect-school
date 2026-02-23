'use client';

// ============================================
// Module Premium - API Export Avancé
// Custom Hook: Export Download
// ============================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { downloadExport, exportJobQueries } from "../queries/exports";
import type { DownloadExportResponse } from "@repo/core/types";

interface UseExportDownloadOptions {
  onSuccess?: (data: DownloadExportResponse) => void;
  onError?: (error: Error) => void;
}

interface UseExportDownloadResult {
  download: (jobId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  data: DownloadExportResponse | null;
}

/**
 * Hook to download an export file
 * Handles generating signed URLs and triggering browser download
 */
export function useExportDownload(options?: UseExportDownloadOptions): UseExportDownloadResult {
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await downloadExport(jobId);
    },
    onSuccess: async (data) => {
      setError(null);

      // Trigger browser download
      try {
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        options?.onSuccess?.(data);
      } catch (downloadError) {
        setError(downloadError as Error);
        options?.onError?.(downloadError as Error);
      }
    },
    onError: (err: Error) => {
      setError(err);
      options?.onError?.(err);
    },
  });

  return {
    download: async (jobId: string) => {
      await mutation.mutateAsync(jobId);
    },
    isLoading: mutation.isPending,
    error,
    data: mutation.data || null,
  };
}

/**
 * Hook to get export job details and download URL
 * Does not automatically trigger download
 */
export function useExportDownloadUrl(jobId: string) {
  return useQuery({
    ...exportJobQueries.getById(jobId),
    enabled: !!jobId,
    select: (job) => {
      if (job.status !== "completed" || !job.file_path) {
        return null;
      }

      // Generate signed URL
      // Note: This would need to be done via Edge Function for security
      return {
        jobId: job.id,
        status: job.status,
        filePath: job.file_path,
        fileName: job.file_path.split("/").pop() || `export_${job.id}`,
        fileSize: job.file_size_bytes,
        rowCount: job.row_count,
        expiresAt: job.expires_at,
      };
    },
  });
}

/**
 * Hook to check if export is ready for download
 * Polls job status until completed
 */
export function useExportReady(jobId: string, pollInterval = 2000) {
  return useQuery({
    ...exportJobQueries.getById(jobId),
    enabled: !!jobId,
    refetchInterval: (data) => {
      // Stop polling when completed or failed
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      return pollInterval;
    },
    select: (job) => ({
      isReady: job.status === "completed" && !!job.file_path,
      status: job.status,
      error: job.error_message,
    }),
  });
}
