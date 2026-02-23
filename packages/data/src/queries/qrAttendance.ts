// Queries for QR Attendance System
// Database queries and hooks for QR codes and scan logs

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../client';
import type {
  QrAttendanceCode,
  QrScanLog,
  GenerateQrCodeInput,
  GenerateQrCodeResponse,
  ValidateQrScanInput,
  ValidateQrScanResponse,
  QrScanLogsFilter,
} from '@nova-connect/core';

const supabase = getSupabaseClient();

// ============================================================================
// QR CODE QUERIES
// ============================================================================

export const qrCodeQueries = {
  // Get active QR codes by school
  getActiveBySchool: async (schoolId: string): Promise<QrAttendanceCode[]> => {
    const { data, error } = await supabase
      .from('qr_attendance_codes')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get QR code by class
  getByClass: async (classId: string): Promise<QrAttendanceCode | null> => {
    const { data, error } = await supabase
      .from('qr_attendance_codes')
      .select('*')
      .eq('class_id', classId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Get QR code by student (for student cards)
  getByStudent: async (studentId: string): Promise<QrAttendanceCode | null> => {
    const { data, error } = await supabase
      .from('qr_attendance_codes')
      .select('*')
      .eq('student_id', studentId)
      .eq('code_type', 'student_card')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Deactivate a QR code
  deactivate: async (qrCodeId: string): Promise<void> => {
    const { error } = await supabase
      .from('qr_attendance_codes')
      .update({ is_active: false })
      .eq('id', qrCodeId);

    if (error) throw error;
  },

  // Generate QR code (via Edge Function)
  generate: async (
    input: GenerateQrCodeInput
  ): Promise<GenerateQrCodeResponse> => {
    const isBrowser =
      typeof window !== 'undefined' &&
      typeof window.location?.origin === 'string';
    if (isBrowser) {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      if (typeof window !== 'undefined') {
        const authMode = window.localStorage.getItem('auth_mode');
        if (authMode) {
          headers['X-Auth-Mode'] = authMode;
        }
        if (!headers.Authorization) {
          const rawTokens = window.localStorage.getItem('offline_auth_tokens');
          if (rawTokens) {
            try {
              const parsed = JSON.parse(rawTokens);
              if (parsed?.access_token) {
                headers.Authorization = `Bearer ${parsed.access_token}`;
              }
            } catch {
              // ignore invalid cache
            }
          }
        }
        if (!headers.Authorization) {
          const storageKeys = Object.keys(window.localStorage);
          const supabaseKey = storageKeys.find((key) =>
            key.startsWith('sb-') && key.endsWith('-auth-token')
          );
          if (supabaseKey) {
            try {
              const raw = window.localStorage.getItem(supabaseKey);
              const parsed = raw ? JSON.parse(raw) : null;
              if (parsed?.access_token) {
                headers.Authorization = `Bearer ${parsed.access_token}`;
              }
            } catch {
              // ignore invalid cache
            }
          }
        }
      }

      const response = await fetch('/api/qr-attendance/generate', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to generate QR code');
      }

      return response.json();
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke(
      'generate-qr-code',
      { body: input }
    );

    if (error) {
      throw new Error(error.message || 'Failed to generate QR code');
    }

    return data as GenerateQrCodeResponse;
  },
};

// ============================================================================
// QR SCAN LOG QUERIES
// ============================================================================

export const qrScanLogQueries = {
  // Get scan logs by student
  getByStudent: async (
    studentId: string,
    filters?: QrScanLogsFilter
  ): Promise<QrScanLog[]> => {
    let query = supabase
      .from('qr_scan_logs')
      .select('*')
      .eq('student_id', studentId)
      .order('scanned_at', { ascending: false });

    // Apply filters
    if (filters?.startDate) {
      query = query.gte('scanned_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('scanned_at', filters.endDate);
    }
    if (filters?.status) {
      query = query.eq('scan_status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Get scan logs by school (admin)
  getBySchool: async (
    schoolId: string,
    filters?: QrScanLogsFilter
  ): Promise<QrScanLog[]> => {
    let query = supabase
      .from('qr_scan_logs')
      .select(
        `
        *,
        students:student_id (
          id,
          first_name,
          last_name,
          user_id
        )
      `
      )
      .eq('school_id', schoolId)
      .order('scanned_at', { ascending: false });

    // Apply filters
    if (filters?.startDate) {
      query = query.gte('scanned_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('scanned_at', filters.endDate);
    }
    if (filters?.status) {
      query = query.eq('scan_status', filters.status);
    }
    if (filters?.classId) {
      // Need to join with qr_attendance_codes
      query = query.eq('qr_code_id', filters.classId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Validate QR scan (via Edge Function)
  validate: async (
    input: ValidateQrScanInput
  ): Promise<ValidateQrScanResponse> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke(
      'validate-qr-scan',
      { body: input }
    );

    if (error) {
      throw new Error(error.message || 'Failed to validate QR scan');
    }

    return data as ValidateQrScanResponse;
  },
};

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useActiveQrCodes(schoolId: string) {
  return useQuery({
    queryKey: ['qr-codes', 'active', schoolId],
    queryFn: () => qrCodeQueries.getActiveBySchool(schoolId),
    enabled: !!schoolId,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

export function useClassQrCode(classId: string) {
  return useQuery({
    queryKey: ['qr-codes', 'class', classId],
    queryFn: () => qrCodeQueries.getByClass(classId),
    enabled: !!classId,
    refetchInterval: 30 * 1000,
  });
}

export function useStudentQrCode(studentId: string) {
  return useQuery({
    queryKey: ['qr-codes', 'student', studentId],
    queryFn: () => qrCodeQueries.getByStudent(studentId),
    enabled: !!studentId,
    refetchInterval: 30 * 1000,
  });
}

export function useGenerateQrCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: qrCodeQueries.generate,
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['qr-codes', 'active', variables.schoolId],
      });
      if (variables.classId) {
        queryClient.invalidateQueries({
          queryKey: ['qr-codes', 'class', variables.classId],
        });
      }
    },
  });
}

export function useDeactivateQrCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: qrCodeQueries.deactivate,
    onSuccess: () => {
      // Invalidate all QR codes queries
      queryClient.invalidateQueries({ queryKey: ['qr-codes'] });
    },
  });
}

export function useValidateQrScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: qrScanLogQueries.validate,
    onSuccess: () => {
      // Invalidate scan logs queries
      queryClient.invalidateQueries({ queryKey: ['qr-scan-logs'] });
      // Invalidate attendance records
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
    },
  });
}

export function useStudentScanLogs(
  studentId: string,
  filters?: QrScanLogsFilter
) {
  return useQuery({
    queryKey: ['qr-scan-logs', 'student', studentId, filters],
    queryFn: () => qrScanLogQueries.getByStudent(studentId, filters),
    enabled: !!studentId,
  });
}

export function useSchoolScanLogs(schoolId: string, filters?: QrScanLogsFilter) {
  return useQuery({
    queryKey: ['qr-scan-logs', 'school', schoolId, filters],
    queryFn: () => qrScanLogQueries.getBySchool(schoolId, filters),
    enabled: !!schoolId,
    refetchInterval: 15 * 1000, // Refetch every 15 seconds for real-time updates
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

// Hook to get QR scan statistics for a school
export function useQrScanStats(schoolId: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['qr-scan-stats', schoolId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('qr_scan_logs')
        .select('scan_status')
        .eq('school_id', schoolId);

      if (startDate) {
        query = query.gte('scanned_at', startDate);
      }
      if (endDate) {
        query = query.lte('scanned_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        success: 0,
        expired_qr: 0,
        invalid_signature: 0,
        wrong_class: 0,
        wrong_time: 0,
        out_of_range: 0,
        rate_limited: 0,
        duplicate_scan: 0,
      };

      data?.forEach((log) => {
        stats[log.scan_status]++;
      });

      return stats;
    },
    enabled: !!schoolId,
  });
}
