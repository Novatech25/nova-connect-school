import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { submissionQueries } from '../queries/elearning';
import type { SubmissionFilters, SubmissionWithRelations, CreateSubmissionInput, GradeSubmissionInput } from '@core/schemas/elearning';

// ============================================
// SUBMISSION QUERIES
// ============================================

export function useSubmissions(
  assignmentId: string,
  options?: Partial<UseQueryOptions<SubmissionWithRelations[]>>
) {
  return useQuery({
    queryKey: ['submissions', assignmentId],
    queryFn: () => submissionQueries.getByAssignment(assignmentId),
    enabled: !!assignmentId,
    ...options,
  });
}

export function useStudentSubmissions(
  studentId: string,
  filters?: SubmissionFilters,
  options?: Partial<UseQueryOptions<SubmissionWithRelations[]>>
) {
  return useQuery({
    queryKey: ['student-submissions', studentId, filters],
    queryFn: () => submissionQueries.getByStudent(studentId, filters),
    enabled: !!studentId,
    ...options,
  });
}

export function useSubmission(
  id: string,
  options?: Partial<UseQueryOptions<SubmissionWithRelations | null>>
) {
  return useQuery({
    queryKey: ['submission', id],
    queryFn: () => submissionQueries.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useAssignmentStats(
  assignmentId: string,
  options?: Partial<UseQueryOptions<any>>
) {
  return useQuery({
    queryKey: ['assignment-stats', assignmentId],
    queryFn: () => submissionQueries.getStats(assignmentId),
    enabled: !!assignmentId,
    ...options,
  });
}

// ============================================
// SUBMISSION MUTATIONS
// ============================================

export function useCreateSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSubmissionInput) => submissionQueries.create(input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submissions', variables.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['student-submissions', variables.studentId] });
    },
  });
}

export function useSubmitSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => submissionQueries.submit(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission', data.id] });
      queryClient.invalidateQueries({ queryKey: ['submissions', data.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['student-submissions', data.studentId] });
      queryClient.invalidateQueries({ queryKey: ['assignment-stats', data.assignmentId] });
    },
  });
}

export function useGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, score, teacherComment }: GradeSubmissionInput & { submissionId: string }) =>
      submissionQueries.grade(submissionId, { score, teacherComment }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission', data.id] });
      queryClient.invalidateQueries({ queryKey: ['submissions', data.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['student-submissions', data.studentId] });
      queryClient.invalidateQueries({ queryKey: ['assignment-stats', data.assignmentId] });
    },
  });
}

export function useReturnSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => submissionQueries.return(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission', data.id] });
      queryClient.invalidateQueries({ queryKey: ['submissions', data.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['student-submissions', data.studentId] });
    },
  });
}
