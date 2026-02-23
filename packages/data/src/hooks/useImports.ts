import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createImportJob,
  getImportJob,
  listImportJobs,
  updateImportJob,
  deleteImportJob,
  createImportTemplate,
  listImportTemplates,
  getImportTemplate,
  updateImportTemplate,
  deleteImportTemplate,
  getImportHistory,
  uploadImportFile
} from '../queries/imports';
import { getSupabaseClient } from '../client';

// Import Jobs
export function useImportJobs(schoolId: string, filters?: {
  importType?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['import-jobs', schoolId, filters],
    queryFn: () => listImportJobs(schoolId, filters),
    enabled: !!schoolId,
  });
}

export function useImportJob(id: string) {
  return useQuery({
    queryKey: ['import-job', id],
    queryFn: () => getImportJob(id),
    enabled: !!id,
  });
}

export function useCreateImportJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createImportJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });
}

export function useUpdateImportJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateImportJob(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['import-job', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });
}

export function useDeleteImportJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteImportJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });
}

// Import Templates
export function useImportTemplates(schoolId: string, importType?: string) {
  return useQuery({
    queryKey: ['import-templates', schoolId, importType],
    queryFn: () => listImportTemplates(schoolId, importType),
    enabled: !!schoolId,
  });
}

export function useImportTemplate(id: string) {
  return useQuery({
    queryKey: ['import-template', id],
    queryFn: () => getImportTemplate(id),
    enabled: !!id,
  });
}

export function useCreateImportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createImportTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-templates'] });
    },
  });
}

export function useUpdateImportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateImportTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-templates'] });
    },
  });
}

export function useDeleteImportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteImportTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-templates'] });
    },
  });
}

// Import History
export function useImportHistory(importJobId: string) {
  return useQuery({
    queryKey: ['import-history', importJobId],
    queryFn: () => getImportHistory(importJobId),
    enabled: !!importJobId,
  });
}

// File Upload
export function useUploadImportFile() {
  return useMutation({
    mutationFn: ({ schoolId, importJobId, file }: {
      schoolId: string;
      importJobId: string;
      file: File;
    }) => uploadImportFile(schoolId, importJobId, file),
  });
}

// Parse Import File
export function useParseImportFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importJobId: string) => {
      const { data, error } = await getSupabaseClient().functions.invoke('parse-import-file', {
        body: { importJobId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['import-job', variables] });
    },
  });
}

// Execute Import
export function useExecuteImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importJobId: string) => {
      const { data, error } = await getSupabaseClient().functions.invoke('execute-import', {
        body: { importJobId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['import-job', variables] });
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });
}

// Rollback Import
export function useRollbackImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (importJobId: string) => {
      const { data, error } = await getSupabaseClient().functions.invoke('rollback-import', {
        body: { importJobId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['import-job', variables] });
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
    },
  });
}
