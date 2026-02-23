import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  lessonLogQueries,
  lessonLogDocumentQueries,
  lessonLogStatsQueries,
} from '../queries/lessonLogs';
import type {
  LessonLog,
  LessonLogWithRelations,
  LessonLogDocument,
  CreateLessonLogInput,
  UpdateLessonLogInput,
  SubmitLessonLogInput,
  ValidateLessonLogInput,
  RejectLessonLogInput,
  DeleteLessonLogInput,
  UploadLessonLogDocumentInput,
  DeleteLessonLogDocumentInput,
  LessonLogFilters,
  TeacherLessonStats,
  SchoolLessonStats,
  ValidateLessonLogLocationInput,
  ValidateLessonLogLocationResponse,
} from '@core/schemas/lessonLog';

// ============================================================================
// LESSON LOGS HOOKS
// ============================================================================

export function useLessonLogs(schoolId: string, filters?: LessonLogFilters) {
  return useQuery({
    queryKey: ['lesson-logs', schoolId, filters],
    queryFn: () => lessonLogQueries.getAll(schoolId, filters),
    enabled: !!schoolId,
  });
}

export function useLessonLog(id: string) {
  return useQuery({
    queryKey: ['lesson-log', id],
    queryFn: () => lessonLogQueries.getById(id),
    enabled: !!id,
  });
}

export function useTeacherLessonLogs(teacherId: string, filters?: LessonLogFilters) {
  return useQuery({
    queryKey: ['lesson-logs', 'teacher', teacherId, filters],
    queryFn: () => lessonLogQueries.getByTeacher(teacherId, filters),
    enabled: !!teacherId,
  });
}

export function useClassLessonLogs(classId: string, filters?: Omit<LessonLogFilters, 'classId'>) {
  return useQuery({
    queryKey: ['lesson-logs', 'class', classId, filters],
    queryFn: () => lessonLogQueries.getByClass(classId, filters),
    enabled: !!classId,
  });
}

export function usePendingLessonLogs(schoolId: string) {
  return useQuery({
    queryKey: ['lesson-logs', 'pending', schoolId],
    queryFn: () => lessonLogQueries.getPendingValidation(schoolId),
    enabled: !!schoolId,
  });
}

export function useValidatedLessonLogs(teacherId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['lesson-logs', 'validated', teacherId, startDate, endDate],
    queryFn: () => lessonLogQueries.getValidatedByTeacher(teacherId, startDate, endDate),
    enabled: !!teacherId && !!startDate && !!endDate,
  });
}

export function useTodayLessonLogs(teacherId: string) {
  return useQuery({
    queryKey: ['lesson-logs', 'today', teacherId],
    queryFn: () => lessonLogQueries.getTodayLessonLogs(teacherId),
    enabled: !!teacherId,
  });
}

export function useLessonLogByPlannedSession(plannedSessionId: string) {
  return useQuery({
    queryKey: ['lesson-log', 'planned', plannedSessionId],
    queryFn: () => lessonLogQueries.getByPlannedSession(plannedSessionId),
    enabled: !!plannedSessionId,
  });
}

export function useCreateLessonLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLessonLogInput) =>
      lessonLogQueries.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log'] });
    },
  });
}

export function useUpdateLessonLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateLessonLogInput) =>
      lessonLogQueries.update(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log', data.id] });
    },
  });
}

export function useSubmitLessonLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitLessonLogInput) =>
      lessonLogQueries.submit(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log', data.id] });
      queryClient.invalidateQueries({ queryKey: ['lesson-logs', 'pending'] });
    },
  });
}

export function useValidateLessonLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ValidateLessonLogInput) =>
      lessonLogQueries.validate(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log', data.id] });
      queryClient.invalidateQueries({ queryKey: ['lesson-logs', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['planned-sessions'] });
    },
  });
}

export function useRejectLessonLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RejectLessonLogInput) =>
      lessonLogQueries.reject(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log', data.id] });
      queryClient.invalidateQueries({ queryKey: ['lesson-logs', 'pending'] });
    },
  });
}

export function useDeleteLessonLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteLessonLogInput) =>
      lessonLogQueries.delete(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-logs'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log'] });
    },
  });
}

// ============================================================================
// LESSON LOG DOCUMENTS HOOKS
// ============================================================================

export function useLessonLogDocuments(lessonLogId: string) {
  return useQuery({
    queryKey: ['lesson-log-documents', lessonLogId],
    queryFn: () => lessonLogDocumentQueries.getByLessonLog(lessonLogId),
    enabled: !!lessonLogId,
  });
}

export function useUploadLessonLogDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UploadLessonLogDocumentInput) =>
      lessonLogDocumentQueries.upload(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lesson-log-documents', data.lessonLogId] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log', data.lessonLogId] });
    },
  });
}

export function useDeleteLessonLogDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteLessonLogDocumentInput) =>
      lessonLogDocumentQueries.delete(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-log-documents'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-log'] });
    },
  });
}

// ============================================================================
// LESSON LOG STATS HOOKS
// ============================================================================

export function useTeacherLessonStats(teacherId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['lesson-log-stats', 'teacher', teacherId, startDate, endDate],
    queryFn: () => lessonLogStatsQueries.getTeacherStats(teacherId, startDate, endDate),
    enabled: !!teacherId && !!startDate && !!endDate,
  });
}

export function useSchoolLessonStats(schoolId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['lesson-log-stats', 'school', schoolId, startDate, endDate],
    queryFn: () => lessonLogStatsQueries.getSchoolStats(schoolId, startDate, endDate),
    enabled: !!schoolId && !!startDate && !!endDate,
  });
}

// ============================================================================
// LESSON LOG LOCATION VALIDATION HOOK
// ============================================================================

export function useValidateLessonLogLocation() {
  return useMutation({
    mutationFn: async (input: ValidateLessonLogLocationInput): Promise<ValidateLessonLogLocationResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-lesson-log-location`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        throw new Error('Location validation failed');
      }

      const data = await response.json();
      return data as ValidateLessonLogLocationResponse;
    },
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get today's planned sessions that don't have a lesson log yet
 */
export function useTodayPlannedSessionsWithoutLog(teacherId: string) {
  return useQuery({
    queryKey: ['planned-sessions', 'without-log', 'today', teacherId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('planned_sessions')
        .select(`
          *,
          class:classes(*),
          subject:subjects(*),
          lesson_log:lesson_logs(id, status)
        `)
        .eq('teacher_id', teacherId)
        .eq('date', today)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Filter out sessions that already have a lesson log
      const sessionsWithoutLog = data?.filter(
        (session: any) => !session.lesson_log
      );

      return sessionsWithoutLog ? snakeToCamelKeys(sessionsWithoutLog) : [];
    },
    enabled: !!teacherId,
  });
}

/**
 * Hook to get planned sessions for a specific date that don't have a lesson log yet
 */
export function usePlannedSessionsWithoutLog(
  teacherId: string,
  date: string
) {
  return useQuery({
    queryKey: ['planned-sessions', 'without-log', date, teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planned_sessions')
        .select(`
          *,
          class:classes(*),
          subject:subjects(*),
          lesson_log:lesson_logs(id, status)
        `)
        .eq('teacher_id', teacherId)
        .eq('date', date)
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Filter out sessions that already have a lesson log
      const sessionsWithoutLog = data?.filter(
        (session: any) => !session.lesson_log
      );

      return sessionsWithoutLog ? snakeToCamelKeys(sessionsWithoutLog) : [];
    },
    enabled: !!teacherId && !!date,
  });
}

// Helper function for camelCase conversion
function snakeToCamelKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(snakeToCamelKeys);
  }

  return Object.keys(obj).reduce((acc: any, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = snakeToCamelKeys(obj[key]);
    return acc;
  }, {});
}
