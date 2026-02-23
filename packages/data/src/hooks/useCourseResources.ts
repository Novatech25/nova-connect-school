import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { courseResourceQueries } from '../queries/elearning';
import type { CourseResourceFilters, CourseResourceWithRelations, CreateCourseResourceInput, UpdateCourseResourceInput } from '@core/schemas/elearning';

// ============================================
// COURSE RESOURCE QUERIES
// ============================================

export function useCourseResources(
  schoolId: string,
  filters?: CourseResourceFilters,
  options?: Partial<UseQueryOptions<CourseResourceWithRelations[]>>
) {
  return useQuery({
    queryKey: ['course-resources', schoolId, filters],
    queryFn: () => courseResourceQueries.getAll(schoolId, filters),
    enabled: !!schoolId,
    ...options,
  });
}

export function useTeacherCourseResources(
  teacherId: string,
  filters?: Omit<CourseResourceFilters, 'teacherId'>,
  options?: Partial<UseQueryOptions<CourseResourceWithRelations[]>>
) {
  return useQuery({
    queryKey: ['teacher-course-resources', teacherId, filters],
    queryFn: () => courseResourceQueries.getByTeacher(teacherId, filters),
    enabled: !!teacherId,
    ...options,
  });
}

export function useClassCourseResources(
  classId: string,
  subjectId?: string,
  options?: Partial<UseQueryOptions<CourseResourceWithRelations[]>>
) {
  return useQuery({
    queryKey: ['class-course-resources', classId, subjectId],
    queryFn: () => courseResourceQueries.getByClass(classId, subjectId),
    enabled: !!classId,
    ...options,
  });
}

export function useCourseResource(
  id: string,
  options?: Partial<UseQueryOptions<CourseResourceWithRelations | null>>
) {
  return useQuery({
    queryKey: ['course-resource', id],
    queryFn: () => courseResourceQueries.getById(id),
    enabled: !!id,
    ...options,
  });
}

// ============================================
// COURSE RESOURCE MUTATIONS
// ============================================

export function useCreateCourseResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCourseResourceInput) => courseResourceQueries.create(input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-course-resources', variables.teacherId] });
    },
  });
}

export function useUpdateCourseResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCourseResourceInput }) =>
      courseResourceQueries.update(id, input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-resource', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-course-resources'] });
    },
  });
}

export function usePublishCourseResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => courseResourceQueries.publish(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['course-resource', data.id] });
      queryClient.invalidateQueries({ queryKey: ['course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['class-course-resources', data.classId] });
    },
  });
}

export function useUnpublishCourseResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => courseResourceQueries.unpublish(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['course-resource', data.id] });
      queryClient.invalidateQueries({ queryKey: ['course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['class-course-resources', data.classId] });
    },
  });
}

export function useDeleteCourseResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => courseResourceQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-course-resources'] });
      queryClient.invalidateQueries({ queryKey: ['class-course-resources'] });
    },
  });
}
