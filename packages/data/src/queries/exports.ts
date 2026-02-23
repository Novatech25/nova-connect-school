// ============================================
// Module Premium - API Export Avancé
// React Query Hooks for Exports
// ============================================

import type { Database } from "../types";
import { getSupabaseClient } from "../client";
import type {
  ExportTemplate,
  ExportJob,
  ScheduledExport,
  ExportApiToken,
  LaunchExportRequest,
  LaunchExportResponse,
  DownloadExportResponse,
  ExportFilters,
  ExportStatistics
} from "@repo/core/types";

const supabase = getSupabaseClient();

type ExportTemplateInsert = Database["public"]["Tables"]["export_templates"]["Insert"];
type ExportTemplateUpdate = Database["public"]["Tables"]["export_templates"]["Update"];
type ExportJobInsert = Database["public"]["Tables"]["export_jobs"]["Insert"];
type ScheduledExportInsert = Database["public"]["Tables"]["scheduled_exports"]["Insert"];
type ScheduledExportUpdate = Database["public"]["Tables"]["scheduled_exports"]["Update"];
type ExportApiTokenInsert = Database["public"]["Tables"]["export_api_tokens"]["Insert"];

// ============================================
// Export Templates Queries
// ============================================

export const exportTemplateQueries = {
  // Get all templates for a school
  getAll: (schoolId: string) => ({
    queryKey: ["export_templates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_templates")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ExportTemplate[];
    },
  }),

  // Get template by ID
  getById: (id: string) => ({
    queryKey: ["export_templates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_templates")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ExportTemplate;
    },
  }),

  // Get templates by resource type
  getByResourceType: (schoolId: string, resourceType: string) => ({
    queryKey: ["export_templates", schoolId, resourceType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_templates")
        .select("*")
        .eq("school_id", schoolId)
        .eq("resource_type", resourceType)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as ExportTemplate[];
    },
  }),
};

// ============================================
// Export Jobs Queries
// ============================================

export const exportJobQueries = {
  // Get all jobs for a school with pagination
  getAll: (schoolId: string, page = 1, limit = 20) => ({
    queryKey: ["export_jobs", schoolId, page, limit],
    queryFn: async () => {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from("export_jobs")
        .select("*", { count: "exact" })
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        data: data as ExportJob[],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    },
  }),

  // Get job by ID
  getById: (id: string) => ({
    queryKey: ["export_jobs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_jobs")
        .select(`
          *,
          template:export_templates(*),
          initiator:users!export_jobs_initiated_by_fkey(id, first_name, last_name, email)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ExportJob & {
        template?: ExportTemplate;
        initiator?: { id: string; first_name: string; last_name: string; email: string };
      };
    },
  }),

  // Get jobs by status (for polling)
  getByStatus: (schoolId: string, status: string[]) => ({
    queryKey: ["export_jobs", schoolId, "status", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_jobs")
        .select("*")
        .eq("school_id", schoolId)
        .in("status", status)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ExportJob[];
    },
  }),

  // Get jobs by scheduled export ID
  getByScheduledId: (scheduledExportId: string) => ({
    queryKey: ["export_jobs", "scheduled", scheduledExportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_jobs")
        .select("*")
        .eq("scheduled_job_id", scheduledExportId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ExportJob[];
    },
  }),
};

// ============================================
// Scheduled Exports Queries
// ============================================

export const scheduledExportQueries = {
  // Get all scheduled exports for a school
  getAll: (schoolId: string) => ({
    queryKey: ["scheduled_exports", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_exports")
        .select(`
          *,
          template:export_templates(*)
        `)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as (ScheduledExport & { template?: ExportTemplate })[];
    },
  }),

  // Get active scheduled exports
  getActive: (schoolId: string) => ({
    queryKey: ["scheduled_exports", schoolId, "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_exports")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("next_run_at", { ascending: true });

      if (error) throw error;
      return data as ScheduledExport[];
    },
  }),

  // Get scheduled export by ID
  getById: (id: string) => ({
    queryKey: ["scheduled_exports", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_exports")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ScheduledExport;
    },
  }),
};

// ============================================
// Export API Tokens Queries
// ============================================

export const exportApiTokenQueries = {
  // Get all tokens for a school
  getAll: (schoolId: string) => ({
    queryKey: ["export_api_tokens", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_api_tokens")
        .select("id, name, description, permissions, created_at, expires_at, last_used_at, usage_count, rate_limit_per_hour, revoked_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Omit<ExportApiToken, "token_hash" | "school_id" | "created_by">[];
    },
  }),

  // Get active tokens
  getActive: (schoolId: string) => ({
    queryKey: ["export_api_tokens", schoolId, "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("export_api_tokens")
        .select("id, name, description, permissions, created_at, expires_at, last_used_at, usage_count, rate_limit_per_hour, revoked_at")
        .eq("school_id", schoolId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Omit<ExportApiToken, "token_hash" | "school_id" | "created_by">[];
    },
  }),
};

// ============================================
// Export Statistics
// ============================================

export const exportStatisticsQueries = {
  // Get export statistics for a school
  getForSchool: (schoolId: string) => ({
    queryKey: ["export_statistics", schoolId],
    queryFn: async () => {
      // Get total exports
      const { count: totalExports } = await supabase
        .from("export_jobs")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId);

      // Get exports this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: exportsThisMonth } = await supabase
        .from("export_jobs")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .gte("created_at", startOfMonth.toISOString());

      // Get exports by type
      const { data: exportsByTypeData } = await supabase
        .from("export_jobs")
        .select("export_type")
        .eq("school_id", schoolId);

      const exportsByType: Record<string, number> = {};
      exportsByTypeData?.forEach((job) => {
        exportsByType[job.export_type] = (exportsByType[job.export_type] || 0) + 1;
      });

      // Get exports by resource type
      const { data: exportsByResourceData } = await supabase
        .from("export_jobs")
        .select("resource_type")
        .eq("school_id", schoolId);

      const exportsByResource: Record<string, number> = {};
      exportsByResourceData?.forEach((job) => {
        exportsByResource[job.resource_type] = (exportsByResource[job.resource_type] || 0) + 1;
      });

      // Get success rate
      const { count: completedExports } = await supabase
        .from("export_jobs")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "completed");

      const { count: failedExports } = await supabase
        .from("export_jobs")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "failed");

      const totalFinishedJobs = (completedExports || 0) + (failedExports || 0);
      const successRate = totalFinishedJobs > 0
        ? (completedExports || 0) / totalFinishedJobs
        : 0;

      // Get average file size
      const { data: fileSizeData } = await supabase
        .from("export_jobs")
        .select("file_size_bytes")
        .eq("school_id", schoolId)
        .eq("status", "completed")
        .not("file_size_bytes", "is", null);

      const totalFileSize = fileSizeData?.reduce((sum, job) => sum + (job.file_size_bytes || 0), 0) || 0;
      const averageFileSize = fileSizeData && fileSizeData.length > 0
        ? totalFileSize / fileSizeData.length
        : 0;

      // Get average processing time
      const { data: processingTimeData } = await supabase
        .from("export_jobs")
        .select("started_at, completed_at")
        .eq("school_id", schoolId)
        .eq("status", "completed")
        .not("started_at", "is", null)
        .not("completed_at", "is", null);

      const totalProcessingTime = processingTimeData?.reduce((sum, job) => {
        if (job.started_at && job.completed_at) {
          const start = new Date(job.started_at).getTime();
          const end = new Date(job.completed_at).getTime();
          return sum + (end - start) / 1000; // Convert to seconds
        }
        return sum;
      }, 0) || 0;

      const averageProcessingTime = processingTimeData && processingTimeData.length > 0
        ? totalProcessingTime / processingTimeData.length
        : 0;

      return {
        totalExports: totalExports || 0,
        exportsThisMonth: exportsThisMonth || 0,
        exportsByType: exportsByType as Record<string, number>,
        exportsByResource: exportsByResource as Record<string, number>,
        successRate,
        averageFileSize,
        averageProcessingTime,
      } as ExportStatistics;
    },
  }),
};

// ============================================
// Mutations
// ============================================

// Create template
export const createTemplate = async (
  schoolId: string,
  template: ExportTemplateInsert
): Promise<ExportTemplate> => {
  const { data, error } = await supabase
    .from("export_templates")
    .insert({
      ...template,
      school_id: schoolId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ExportTemplate;
};

// Update template
export const updateTemplate = async (
  id: string,
  updates: ExportTemplateUpdate
): Promise<ExportTemplate> => {
  const { data, error } = await supabase
    .from("export_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ExportTemplate;
};

// Delete template
export const deleteTemplate = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("export_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// Launch export
export const launchExport = async (
  request: LaunchExportRequest
): Promise<LaunchExportResponse> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/launch-export`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to launch export");
  }

  return response.json();
};

// Download export
export const downloadExport = async (
  jobId: string
): Promise<DownloadExportResponse> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-export`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to download export");
  }

  return response.json();
};

// Create scheduled export
export const createScheduledExport = async (
  schoolId: string,
  scheduledExport: ScheduledExportInsert
): Promise<ScheduledExport> => {
  const { data, error } = await supabase
    .from("scheduled_exports")
    .insert({
      ...scheduledExport,
      school_id: schoolId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledExport;
};

// Update scheduled export
export const updateScheduledExport = async (
  id: string,
  updates: ScheduledExportUpdate
): Promise<ScheduledExport> => {
  const { data, error } = await supabase
    .from("scheduled_exports")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledExport;
};

// Delete scheduled export
export const deleteScheduledExport = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("scheduled_exports")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// Toggle scheduled export active status
export const toggleScheduledExport = async (
  id: string,
  isActive: boolean
): Promise<ScheduledExport> => {
  return updateScheduledExport(id, { is_active: isActive });
};

// Create API token
export const createApiToken = async (
  schoolId: string,
  token: Omit<ExportApiTokenInsert, "token_hash" | "school_id"> & { token: string }
): Promise<{ token: string; tokenId: string }> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-export-api-token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create",
        ...token,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create API token");
  }

  return response.json();
};

// Revoke API token
export const revokeApiToken = async (tokenId: string): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-export-api-token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "revoke",
        tokenId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke API token");
  }
};
