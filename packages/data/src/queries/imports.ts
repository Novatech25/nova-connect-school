import { getSupabaseClient } from '../client';
import type { CreateImportJob, CreateImportTemplate, ImportJob, ImportTemplate } from '@novaconnect/core';

// Import Jobs
export async function createImportJob(data: CreateImportJob & { initiatedBy: string }) {
  // Convert camelCase to snake_case for database
  const dbData = {
    school_id: data.schoolId,
    import_type: data.importType,
    file_name: data.fileName,
    file_path: data.filePath,
    initiated_by: data.initiatedBy,
    status: data.status || 'uploaded',
    column_mapping: data.columnMapping || {},
    total_rows: data.totalRows || 0,
    valid_rows: data.validRows || 0,
    invalid_rows: data.invalidRows || 0,
    validation_errors: data.validationErrors || [],
    can_rollback: data.canRollback || false,
  };

  const { data: result, error } = await getSupabaseClient()
    .from('import_jobs')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getImportJob(id: string) {
  const { data, error } = await getSupabaseClient()
    .from('import_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function listImportJobs(
  schoolId: string,
  filters?: {
    importType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
) {
  let query = getSupabaseClient()
    .from('import_jobs')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (filters?.importType) {
    query = query.eq('import_type', filters.importType);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateImportJob(id: string, data: Partial<ImportJob>) {
  const { data: result, error } = await getSupabaseClient()
    .from('import_jobs')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteImportJob(id: string) {
  const { error } = await getSupabaseClient()
    .from('import_jobs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Import Templates
export async function createImportTemplate(data: CreateImportTemplate & { createdBy: string }) {
  // Convert camelCase to snake_case for database
  const dbData = {
    school_id: data.schoolId,
    name: data.name,
    import_type: data.importType,
    description: data.description,
    column_mapping: data.columnMapping || {},
    created_by: data.createdBy,
  };

  const { data: result, error } = await getSupabaseClient()
    .from('import_templates')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function listImportTemplates(schoolId: string, importType?: string) {
  let query = getSupabaseClient()
    .from('import_templates')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (importType) {
    query = query.eq('import_type', importType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getImportTemplate(id: string) {
  const { data, error } = await getSupabaseClient()
    .from('import_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateImportTemplate(id: string, data: Partial<ImportTemplate>) {
  const { data: result, error } = await getSupabaseClient()
    .from('import_templates')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteImportTemplate(id: string) {
  const { error } = await getSupabaseClient()
    .from('import_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Import History
export async function getImportHistory(importJobId: string) {
  const { data, error } = await getSupabaseClient()
    .from('import_history')
    .select('*')
    .eq('import_job_id', importJobId)
    .order('row_number', { ascending: true });

  if (error) throw error;
  return data;
}

// Storage
export async function uploadImportFile(
  schoolId: string,
  importJobId: string,
  file: File
): Promise<{ path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${schoolId}/${importJobId}/${Date.now()}_${file.name}`;

  const { data, error } = await getSupabaseClient().storage
    .from('imports')
    .upload(fileName, file);

  if (error) throw error;
  return { path: data.path };
}
