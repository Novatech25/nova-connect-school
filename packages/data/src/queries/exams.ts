import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../client';
import { snakeToCamelKeys } from '../helpers/transform';
import type {
  ExamSession,
  CreateExamSessionInput,
  ExamDeliberation,
  ExamCenter,
  ExamJury,
  ExamResult,
  ExamMinute,
} from '@novaconnect/core';

// Query keys
export const examKeys = {
  all: ['exams'] as const,
  sessions: () => [...examKeys.all, 'sessions'] as const,
  session: (id: string) => [...examKeys.sessions(), id] as const,
  centers: (sessionId: string) => [...examKeys.session(sessionId), 'centers'] as const,
  juries: (sessionId: string) => [...examKeys.session(sessionId), 'juries'] as const,
  deliberations: (sessionId: string) => [...examKeys.session(sessionId), 'deliberations'] as const,
  results: (sessionId: string) => [...examKeys.session(sessionId), 'results'] as const,
  minutes: (sessionId: string) => [...examKeys.session(sessionId), 'minutes'] as const,
};

// Fetch exam sessions
export function useExamSessions(filters?: any) {
  return useQuery({
    queryKey: [...examKeys.sessions(), filters],
    queryFn: async () => {
      let query = getSupabaseClient()
        .from('exam_sessions')
        .select('*, academic_years(name), periods(name)')
        .order('start_date', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.examType) query = query.eq('exam_type', filters.examType);
      if (filters?.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data) as ExamSession[];
    },
  });
}

// Fetch single exam session
export function useExamSession(id: string) {
  return useQuery({
    queryKey: examKeys.session(id),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_sessions')
        .select('*, academic_years(*), periods(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data) as ExamSession;
    },
    enabled: !!id,
  });
}

// Create exam session
export function useCreateExamSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExamSessionInput) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_sessions')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.sessions() });
    },
  });
}

// Update exam session
export function useUpdateExamSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ExamSession> & { id: string }) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: examKeys.session(variables.id) });
      queryClient.invalidateQueries({ queryKey: examKeys.sessions() });
    },
  });
}

// Delete exam session
export function useDeleteExamSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient()
        .from('exam_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.sessions() });
    },
  });
}

// Fetch exam centers
export function useExamCenters(sessionId: string) {
  return useQuery({
    queryKey: examKeys.centers(sessionId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_centers')
        .select('*')
        .eq('exam_session_id', sessionId)
        .order('name');

      if (error) throw error;
      return snakeToCamelKeys(data) as ExamCenter[];
    },
    enabled: !!sessionId,
  });
}

// Create exam center
export function useCreateExamCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_centers')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: examKeys.centers(variables.exam_session_id) });
    },
  });
}

// Fetch exam juries
export function useExamJuries(sessionId: string) {
  return useQuery({
    queryKey: examKeys.juries(sessionId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_juries')
        .select('*')
        .eq('exam_session_id', sessionId)
        .order('name');

      if (error) throw error;
      return snakeToCamelKeys(data) as ExamJury[];
    },
    enabled: !!sessionId,
  });
}

// Create exam jury
export function useCreateExamJury() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_juries')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: examKeys.juries(variables.exam_session_id) });
    },
  });
}

// Fetch deliberations
export function useExamDeliberations(sessionId: string) {
  return useQuery({
    queryKey: examKeys.deliberations(sessionId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_deliberations')
        .select('*, exam_juries(*), classes(*)')
        .eq('exam_session_id', sessionId)
        .order('deliberation_date', { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data) as ExamDeliberation[];
    },
    enabled: !!sessionId,
  });
}

// Create deliberation
export function useCreateDeliberation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_deliberations')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: examKeys.deliberations(variables.exam_session_id) });
    },
  });
}

// Calculate exam results
export function useCalculateExamResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliberationId: string) => {
      const { data, error } = await getSupabaseClient().functions.invoke('calculate-exam-results', {
        body: { deliberationId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}

// Publish exam results
export function usePublishExamResults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliberationId: string) => {
      const { data, error } = await getSupabaseClient().functions.invoke('publish-exam-results', {
        body: { deliberationId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}

// Fetch exam results
export function useExamResults(sessionId: string) {
  return useQuery({
    queryKey: examKeys.results(sessionId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_results')
        .select('*, students(*)')
        .eq('exam_session_id', sessionId)
        .order('overall_average', { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data) as ExamResult[];
    },
    enabled: !!sessionId,
  });
}

// Fetch exam minutes
export function useExamMinutes(sessionId: string) {
  return useQuery({
    queryKey: examKeys.minutes(sessionId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_minutes')
        .select('*')
        .eq('exam_session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data) as ExamMinute[];
    },
    enabled: !!sessionId,
  });
}

// Create exam minute
export function useCreateExamMinute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_minutes')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: examKeys.minutes(variables.exam_session_id) });
    },
  });
}

// Generate exam minute PDF
export function useGenerateExamMinutePDF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (minuteId: string) => {
      const { data, error } = await getSupabaseClient().functions.invoke('generate-exam-minute-pdf', {
        body: { minuteId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}

// ============================================
// EXAM GRADES MANAGEMENT
// ============================================

export const examGradeKeys = {
  all: ['examGrades'] as const,
  forSession: (sessionId: string) => [...examGradeKeys.all, 'session', sessionId] as const,
  forDeliberation: (deliberationId: string) => [...examGradeKeys.all, 'deliberation', deliberationId] as const,
  forStudent: (studentId: string, sessionId: string) => [...examGradeKeys.all, 'student', studentId, sessionId] as const,
};

// Fetch exam grades for a session
export function useExamGrades(sessionId: string) {
  return useQuery({
    queryKey: examGradeKeys.forSession(sessionId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_grades')
        .select('*, grades(*), students(*)')
        .eq('exam_session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    enabled: !!sessionId,
  });
}

// Fetch exam grades for a deliberation (for jury review)
export function useExamGradesForDeliberation(deliberationId: string) {
  return useQuery({
    queryKey: examGradeKeys.forDeliberation(deliberationId),
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from('exam_grades')
        .select('*, grades(*), students(*), exam_sessions(*)')
        .eq('exam_session_id', deliberationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    enabled: !!deliberationId,
  });
}

// Create exam grade (links an existing grade to an exam session)
export function useCreateExamGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      examSessionId: string;
      gradeId: string;
      schoolId: string;
    }) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_grades')
        .insert({
          exam_session_id: input.examSessionId,
          grade_id: input.gradeId,
          school_id: input.schoolId,
        })
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: examGradeKeys.forSession(variables.examSessionId) });
    },
  });
}

// Validate exam grade by jury
export function useValidateExamGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      examGradeId: string;
      validatedBy: string;
    }) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_grades')
        .update({
          validated_by_jury: true,
          validated_at: new Date().toISOString(),
          validated_by: input.validatedBy,
        })
        .eq('id', input.examGradeId)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}

// Contest exam grade
export function useContestExamGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      examGradeId: string;
      reason: string;
    }) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_grades')
        .update({
          is_contested: true,
          contest_reason: input.reason,
        })
        .eq('id', input.examGradeId)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}

// Resolve contestation
export function useResolveExamGradeContestation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      examGradeId: string;
      resolution: string;
    }) => {
      const { data, error } = await getSupabaseClient()
        .from('exam_grades')
        .update({
          is_contested: false,
          contest_resolution: input.resolution,
        })
        .eq('id', input.examGradeId)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}
