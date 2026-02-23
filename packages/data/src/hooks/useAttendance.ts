import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../client';
import {
  attendanceSessionQueries,
  attendanceRecordQueries,
  attendanceStatsQueries,
} from '../queries/attendance';
import type {
  AttendanceSession,
  AttendanceRecord,
  CreateAttendanceSessionInput,
  UpdateAttendanceSessionInput,
  SubmitAttendanceSessionInput,
  ValidateAttendanceSessionInput,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  BulkAttendanceRecordsInput,
  AttendanceSessionFilters,
  AttendanceStats,
  StudentAttendanceSummary,
} from '@core/schemas/attendance';

// ============================================================================
// ATTENDANCE SESSIONS HOOKS
// ============================================================================

export function useAttendanceSessions(schoolId: string, filters?: AttendanceSessionFilters) {
  return useQuery({
    queryKey: ['attendance-sessions', schoolId, filters],
    queryFn: () => attendanceSessionQueries.getAll(schoolId, filters),
    enabled: !!schoolId,
  });
}

export function useAttendanceSession(id: string) {
  return useQuery({
    queryKey: ['attendance-session', id],
    queryFn: () => attendanceSessionQueries.getById(id),
    enabled: !!id,
  });
}

export function useTeacherAttendanceSessions(teacherId: string, date: string) {
  return useQuery({
    queryKey: ['attendance-sessions', 'teacher', teacherId, date],
    queryFn: () => attendanceSessionQueries.getByTeacher(teacherId, date),
    enabled: !!teacherId && !!date,
  });
}

export function useTodayAttendanceSessions(teacherId: string) {
  return useQuery({
    queryKey: ['attendance-sessions', 'today', teacherId],
    queryFn: () => attendanceSessionQueries.getTodaySessions(teacherId),
    enabled: !!teacherId,
  });
}

export function useAttendanceSessionByPlannedSession(plannedSessionId: string) {
  return useQuery({
    queryKey: ['attendance-session', 'planned', plannedSessionId],
    queryFn: () => attendanceSessionQueries.getByPlannedSession(plannedSessionId),
    enabled: !!plannedSessionId,
  });
}

export function useCreateAttendanceSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAttendanceSessionInput) =>
      attendanceSessionQueries.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-session'] });
    },
  });
}

export function useUpdateAttendanceSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAttendanceSessionInput) =>
      attendanceSessionQueries.update(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-session', data.id] });
    },
  });
}

export function useSubmitAttendanceSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitAttendanceSessionInput) =>
      attendanceSessionQueries.submit(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-session', data.id] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
    },
  });
}

export function useValidateAttendanceSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ValidateAttendanceSessionInput) =>
      attendanceSessionQueries.validate(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-session', data.id] });
    },
  });
}

export function useDeleteAttendanceSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => attendanceSessionQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-session'] });
    },
  });
}

// ============================================================================
// ATTENDANCE RECORDS HOOKS
// ============================================================================

export function useAttendanceRecords(sessionId: string) {
  return useQuery({
    queryKey: ['attendance-records', sessionId],
    queryFn: () => attendanceRecordQueries.getBySession(sessionId),
    enabled: !!sessionId,
  });
}

export function useStudentAttendance(studentId: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['attendance-records', 'student', studentId, startDate, endDate],
    queryFn: () => attendanceRecordQueries.getByStudent(studentId, startDate, endDate),
    enabled: !!studentId,
  });
}

export function useStudentAttendanceByDate(studentId: string, date: string) {
  return useQuery({
    queryKey: ['attendance-records', 'student', studentId, date],
    queryFn: () => attendanceRecordQueries.getByStudentAndDate(studentId, date),
    enabled: !!studentId && !!date,
  });
}

export function useCreateAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAttendanceRecordInput) =>
      attendanceRecordQueries.create(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records', data.attendanceSessionId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records', 'student'] });
    },
  });
}

export function useCreateBulkAttendanceRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (records: BulkAttendanceRecordsInput) =>
      attendanceRecordQueries.createBulk(records),
    onSuccess: (data) => {
      if (data.length > 0) {
        const sessionId = data[0].attendanceSessionId;
        queryClient.invalidateQueries({ queryKey: ['attendance-records', sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['attendance-records', 'student'] });
    },
  });
}

export function useUpdateAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAttendanceRecordInput) =>
      attendanceRecordQueries.update(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records', data.attendanceSessionId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records', 'student', data.studentId] });
    },
  });
}

export function useDeleteAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => attendanceRecordQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records', 'student'] });
    },
  });
}

// ============================================================================
// ATTENDANCE STATS HOOKS
// ============================================================================

export function useAttendanceStats(
  schoolId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    classId?: string;
  }
) {
  return useQuery({
    queryKey: ['attendance-stats', schoolId, filters],
    queryFn: () => attendanceStatsQueries.getAttendanceStats(schoolId, filters),
    enabled: !!schoolId,
  });
}

export function useAttendanceByStudent(
  schoolId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    classId?: string;
  }
) {
  return useQuery({
    queryKey: ['attendance-by-student', schoolId, filters],
    queryFn: () => attendanceStatsQueries.getAttendanceByStudent(schoolId, filters),
    enabled: !!schoolId,
  });
}

// ============================================================================
// COMBINED HOOKS
// ============================================================================

export function useAttendanceSessionWithRecords(sessionId: string) {
  const session = useAttendanceSession(sessionId);
  const records = useAttendanceRecords(sessionId);

  return {
    session: session.data,
    records: records.data,
    isLoading: session.isLoading || records.isLoading,
    error: session.error || records.error,
  };
}

export function useAttendance(classId: string, date: string) {
  const queryClient = useQueryClient();

  const attendance = useQuery({
    queryKey: ['attendance', 'class', classId, date],
    queryFn: async () => {
      // Legacy compatibility - this would need to be adapted to the new structure
      // For now, return empty array
      return [];
    },
    enabled: !!classId && !!date,
  });

  const createAttendance = useMutation({
    mutationFn: async (record: CreateAttendanceRecordInput) => {
      return attendanceRecordQueries.create(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const createBulkAttendance = useMutation({
    mutationFn: async (records: BulkAttendanceRecordsInput) => {
      return attendanceRecordQueries.createBulk(records);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const updateAttendance = useMutation({
    mutationFn: async (input: UpdateAttendanceRecordInput) => {
      return attendanceRecordQueries.update(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const deleteAttendance = useMutation({
    mutationFn: async (id: string) => {
      return attendanceRecordQueries.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  return {
    attendance: attendance.data,
    isLoading: attendance.isLoading,
    error: attendance.error,
    createAttendance,
    createBulkAttendance,
    updateAttendance,
    deleteAttendance,
  };
}

export function useStudentAttendanceLegacy(studentId: string, startDate?: string, endDate?: string) {
  const attendance = useQuery({
    queryKey: ['attendance', 'student', studentId, startDate, endDate],
    queryFn: () => attendanceRecordQueries.getByStudent(studentId, startDate, endDate),
    enabled: !!studentId,
  });

  return {
    attendance: attendance.data,
    isLoading: attendance.isLoading,
    error: attendance.error,
  };
}

// ============================================================================
// ATTENDANCE FUSION HOOKS
// ============================================================================

export function useAttendanceRecordHistory(recordId: string) {
  return useQuery({
    queryKey: ['attendance-record-history', recordId],
    queryFn: () => attendanceRecordQueries.getRecordHistory(recordId),
    enabled: !!recordId,
  });
}

export function useConflictingRecords(
  schoolId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    classId?: string;
    recordStatus?: 'auto' | 'confirmed' | 'overridden' | 'manual';
  }
) {
  return useQuery({
    queryKey: ['conflicting-attendance-records', schoolId, filters],
    queryFn: () => attendanceRecordQueries.getConflictingRecords(schoolId, filters),
    enabled: !!schoolId,
  });
}

export function useFusionStats(
  schoolId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
  }
) {
  return useQuery({
    queryKey: ['fusion-stats', schoolId, filters],
    queryFn: () => attendanceStatsQueries.getFusionStats(schoolId, filters),
    enabled: !!schoolId,
  });
}

export function useMergeAttendanceRecord() {
  const queryClient = useQueryClient();
  const supabase = getSupabaseClient();

  return useMutation({
    mutationFn: async (input: {
      attendanceRecordId: string;
      newStatus: 'present' | 'absent' | 'late' | 'excused';
      recordStatus: 'confirmed' | 'overridden';
      justification?: string;
      comment?: string;
    }) => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/merge-attendance-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to merge attendance record');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-record-history'] });
      queryClient.invalidateQueries({ queryKey: ['conflicting-attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['fusion-stats'] });
    },
  });
}

