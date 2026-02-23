import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { assignmentQueries } from '../queries/elearning';
import type { AssignmentFilters, AssignmentWithRelations, CreateAssignmentInput, UpdateAssignmentInput } from '@core/schemas/elearning';

// ============================================
// ASSIGNMENT QUERIES
// ============================================

export function useAssignments(
  schoolId: string,
  filters?: AssignmentFilters,
  options?: Partial<UseQueryOptions<AssignmentWithRelations[]>>
) {
  return useQuery({
    queryKey: ['assignments', schoolId, filters],
    queryFn: () => assignmentQueries.getAll(schoolId, filters),
    enabled: !!schoolId,
    ...options,
  });
}

export function useAssignment(
  id: string,
  options?: Partial<UseQueryOptions<AssignmentWithRelations | null>>
) {
  return useQuery({
    queryKey: ['assignment', id],
    queryFn: () => assignmentQueries.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useTeacherElearningAssignments(
  teacherId: string,
  filters?: Omit<AssignmentFilters, 'teacherId'>,
  options?: Partial<UseQueryOptions<AssignmentWithRelations[]>>
) {
  return useQuery({
    queryKey: ['teacher-assignments', teacherId, filters],
    queryFn: () => assignmentQueries.getByTeacher(teacherId, filters),
    enabled: !!teacherId,
    ...options,
  });
}

export function useClassAssignments(
  classId: string,
  filters?: Omit<AssignmentFilters, 'classId'>,
  options?: Partial<UseQueryOptions<AssignmentWithRelations[]>>
) {
  return useQuery({
    queryKey: ['class-assignments', classId, filters],
    queryFn: () => assignmentQueries.getByClass(classId, filters),
    enabled: !!classId,
    ...options,
  });
}

export function useUpcomingAssignments(
  classId: string,
  limit: number = 5,
  options?: Partial<UseQueryOptions<AssignmentWithRelations[]>>
) {
  return useQuery({
    queryKey: ['upcoming-assignments', classId, limit],
    queryFn: () => assignmentQueries.getUpcoming(classId, limit),
    enabled: !!classId,
    ...options,
  });
}

// ============================================
// ASSIGNMENT MUTATIONS
// ============================================

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAssignmentInput) => assignmentQueries.create(input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments', variables.teacherId] });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssignmentInput }) =>
      assignmentQueries.update(id, input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assignment', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    },
  });
}

export function usePublishAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assignmentQueries.publish(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignment', data.id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['class-assignments', data.classId] });
    },
  });
}

export function useCloseAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assignmentQueries.close(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignment', data.id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['class-assignments', data.classId] });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assignmentQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    },
  });
}
