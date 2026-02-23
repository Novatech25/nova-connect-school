import { getSupabaseClient } from '../client';

// ============================================
// ASSIGNMENT FILE STORAGE
// ============================================

export async function uploadAssignmentFile(
  schoolId: string,
  assignmentId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${schoolId}/${assignmentId}/${fileName}`;

  const { data, error } = await getSupabaseClient().storage
    .from('assignment-files')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload assignment file: ${error.message}`);
  }

  const { data: urlData } = getSupabaseClient().storage
    .from('assignment-files')
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}

export async function deleteAssignmentFile(filePath: string): Promise<void> {
  const { error } = await getSupabaseClient().storage
    .from('assignment-files')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete assignment file: ${error.message}`);
  }
}

export async function getAssignmentFileUrl(filePath: string): Promise<string> {
  const { data } = getSupabaseClient().storage
    .from('assignment-files')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ============================================
// SUBMISSION FILE STORAGE
// ============================================

export async function uploadSubmissionFile(
  schoolId: string,
  submissionId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${schoolId}/${submissionId}/${fileName}`;

  const { data, error } = await getSupabaseClient().storage
    .from('submission-files')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload submission file: ${error.message}`);
  }

  const { data: urlData } = getSupabaseClient().storage
    .from('submission-files')
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}

export async function deleteSubmissionFile(filePath: string): Promise<void> {
  const { error } = await getSupabaseClient().storage
    .from('submission-files')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete submission file: ${error.message}`);
  }
}

export async function getSubmissionFileUrl(filePath: string): Promise<string> {
  const { data } = getSupabaseClient().storage
    .from('submission-files')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ============================================
// CORRECTION FILE STORAGE
// ============================================

export async function uploadCorrectionFile(
  schoolId: string,
  submissionId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${schoolId}/${submissionId}/${fileName}`;

  const { data, error } = await getSupabaseClient().storage
    .from('correction-files')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload correction file: ${error.message}`);
  }

  const { data: urlData } = getSupabaseClient().storage
    .from('correction-files')
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}

export async function deleteCorrectionFile(filePath: string): Promise<void> {
  const { error } = await getSupabaseClient().storage
    .from('correction-files')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete correction file: ${error.message}`);
  }
}

export async function getCorrectionFileUrl(filePath: string): Promise<string> {
  const { data } = getSupabaseClient().storage
    .from('correction-files')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ============================================
// COURSE RESOURCE STORAGE
// ============================================

export async function uploadCourseResource(
  schoolId: string,
  resourceId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${schoolId}/${resourceId}/${fileName}`;

  const { data, error } = await getSupabaseClient().storage
    .from('course-resources')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload course resource: ${error.message}`);
  }

  const { data: urlData } = getSupabaseClient().storage
    .from('course-resources')
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, path: filePath };
}

export async function deleteCourseResource(filePath: string): Promise<void> {
  const { error } = await getSupabaseClient().storage
    .from('course-resources')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete course resource: ${error.message}`);
  }
}

export async function getCourseResourceUrl(filePath: string): Promise<string> {
  const { data } = getSupabaseClient().storage
    .from('course-resources')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// ============================================
// FILE VALIDATION HELPERS
// ============================================

export const ALLOWED_ASSIGNMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'application/zip',
];

export const ALLOWED_SUBMISSION_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'application/zip',
];

export const ALLOWED_CORRECTION_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

export const ALLOWED_RESOURCE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'video/mp4',
  'application/zip',
];

export const MAX_ASSIGNMENT_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_SUBMISSION_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_CORRECTION_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_RESOURCE_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function validateAssignmentFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_ASSIGNMENT_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Type de fichier non supporté. Formats acceptés : PDF, Word, Images, ZIP',
    };
  }

  if (file.size > MAX_ASSIGNMENT_FILE_SIZE) {
    return {
      valid: false,
      error: 'Le fichier ne doit pas dépasser 50MB',
    };
  }

  return { valid: true };
}

export function validateSubmissionFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_SUBMISSION_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Type de fichier non supporté. Formats acceptés : PDF, Word, Images, ZIP',
    };
  }

  if (file.size > MAX_SUBMISSION_FILE_SIZE) {
    return {
      valid: false,
      error: 'Le fichier ne doit pas dépasser 50MB',
    };
  }

  return { valid: true };
}

export function validateCorrectionFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_CORRECTION_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Type de fichier non supporté. Formats acceptés : PDF, Word, Images',
    };
  }

  if (file.size > MAX_CORRECTION_FILE_SIZE) {
    return {
      valid: false,
      error: 'Le fichier ne doit pas dépasser 50MB',
    };
  }

  return { valid: true };
}

export function validateResourceFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_RESOURCE_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Type de fichier non supporté. Formats acceptés : PDF, Word, PowerPoint, Images, Vidéos, ZIP',
    };
  }

  if (file.size > MAX_RESOURCE_FILE_SIZE) {
    return {
      valid: false,
      error: 'Le fichier ne doit pas dépasser 100MB',
    };
  }

  return { valid: true };
}

// ============================================
// FILE TYPE HELPERS
// ============================================

export function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📊';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('video')) return '🎥';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
  return '📎';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}
