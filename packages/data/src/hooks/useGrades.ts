import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gradeQueries, gradeSubmissionQueries } from '../queries/grades';
import type {
  Grade,
  CreateGradeInput,
  UpdateGradeInput,
  BulkGradesInput,
  SubmitGradeInput,
  ApproveGradeInput,
  PublishGradeInput,
  RejectGradeInput,
  GradeFilters,
  GradeVersion,
  GradeSubmission,
  CreateGradeSubmissionInput,
  UpdateGradeSubmissionInput,
  SubmitGradeSubmissionInput,
  ApproveGradeSubmissionInput,
  RejectGradeSubmissionInput,
  GradeSubmissionFilters,
  GradeStatistics,
  StudentGradeSummary,
} from '@core/schemas/grades';

// ============================================================================
// GRADES HOOKS
// ============================================================================

/**
 * Get all grades for a school with optional filters
 */
export function useGrades(schoolId: string, filters?: GradeFilters) {
  return useQuery({
    queryKey: ['grades', schoolId, filters],
    queryFn: () => gradeQueries.getAll(schoolId, filters),
    enabled: !!schoolId,
  });
}

/**
 * Get a single grade by ID
 */
export function useGrade(id: string) {
  return useQuery({
    queryKey: ['grade', id],
    queryFn: () => gradeQueries.getById(id),
    enabled: !!id,
  });
}

/**
 * Get grades for a student
 */
export function useStudentGrades(studentId: string, periodId?: string) {
  return useQuery({
    queryKey: ['grades', 'student', studentId, periodId],
    queryFn: () => gradeQueries.getByStudent(studentId, periodId),
    enabled: !!studentId,
  });
}

/**
 * Get grades for a class (for teacher view)
 */
export function useClassGrades(classId: string, subjectId: string, periodId: string) {
  return useQuery({
    queryKey: ['grades', 'class', classId, subjectId, periodId],
    queryFn: () => gradeQueries.getByClass(classId, subjectId, periodId),
    enabled: !!classId && !!subjectId && !!periodId,
  });
}

/**
 * Get grades for a teacher
 */
export function useTeacherGrades(teacherId: string, filters?: GradeFilters) {
  return useQuery({
    queryKey: ['grades', 'teacher', teacherId, filters],
    queryFn: () => gradeQueries.getByTeacher(teacherId, filters),
    enabled: !!teacherId,
  });
}

/**
 * Create a single grade
 */
export function useCreateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGradeInput) => gradeQueries.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
    },
  });
}

/**
 * Create multiple grades in bulk
 */
export function useCreateBulkGrades() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkGradesInput) => gradeQueries.createBulk(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
    },
  });
}

/**
 * Update a grade
 */
export function useUpdateGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateGradeInput) => gradeQueries.update(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade', data.id] });
    },
  });
}

/**
 * Delete a grade
 */
export function useDeleteGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => gradeQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
    },
  });
}

// ============================================================================
// GRADE WORKFLOW HOOKS
// ============================================================================

/**
 * Submit a grade for validation
 */
export function useSubmitGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitGradeInput) => gradeQueries.submit(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade', data.id] });
    },
  });
}

/**
 * Approve a grade (admin/supervisor)
 */
export function useApproveGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApproveGradeInput) => gradeQueries.approve(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade', data.id] });
    },
  });
}

/**
 * Publish a grade (makes visible to students/parents)
 */
export function usePublishGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PublishGradeInput) => gradeQueries.publish(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade', data.id] });
    },
  });
}

/**
 * Reject a grade (returns to draft)
 */
export function useRejectGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RejectGradeInput) => gradeQueries.reject(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['grade', data.id] });
    },
  });
}

// ============================================================================
// GRADE VERSION HOOKS
// ============================================================================

/**
 * Get version history for a grade
 */
export function useGradeVersions(gradeId: string) {
  return useQuery({
    queryKey: ['grade-versions', gradeId],
    queryFn: () => gradeQueries.getVersions(gradeId),
    enabled: !!gradeId,
  });
}

// ============================================================================
// GRADE STATISTICS HOOKS
// ============================================================================

/**
 * Get class grade statistics
 */
export function useClassGradeStatistics(
  classId: string,
  subjectId: string,
  periodId: string
) {
  return useQuery({
    queryKey: ['grade-statistics', 'class', classId, subjectId, periodId],
    queryFn: () => gradeQueries.getClassStatistics(classId, subjectId, periodId),
    enabled: !!classId && !!subjectId && !!periodId,
  });
}

/**
 * Get student grade summary
 */
export function useStudentGradeSummary(studentId: string, periodId: string) {
  return useQuery({
    queryKey: ['grade-summary', 'student', studentId, periodId],
    queryFn: () => gradeQueries.getStudentSummary(studentId, periodId),
    enabled: !!studentId && !!periodId,
  });
}

// ============================================================================
// GRADE SUBMISSIONS HOOKS
// ============================================================================

/**
 * Get all grade submissions for a school
 */
export function useGradeSubmissions(schoolId: string, filters?: GradeSubmissionFilters) {
  return useQuery({
    queryKey: ['grade-submissions', schoolId, filters],
    queryFn: () => gradeSubmissionQueries.getAll(schoolId, filters),
    enabled: !!schoolId,
  });
}

/**
 * Get a single grade submission by ID
 */
export function useGradeSubmission(id: string) {
  return useQuery({
    queryKey: ['grade-submission', id],
    queryFn: () => gradeSubmissionQueries.getById(id),
    enabled: !!id,
  });
}

/**
 * Get grade submissions for a teacher
 */
export function useTeacherGradeSubmissions(
  teacherId: string,
  filters?: GradeSubmissionFilters
) {
  return useQuery({
    queryKey: ['grade-submissions', 'teacher', teacherId, filters],
    queryFn: () => gradeSubmissionQueries.getByTeacher(teacherId, filters),
    enabled: !!teacherId,
  });
}

/**
 * Create a grade submission
 */
export function useCreateGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGradeSubmissionInput) =>
      gradeSubmissionQueries.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
    },
  });
}

/**
 * Update a grade submission
 */
export function useUpdateGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateGradeSubmissionInput) =>
      gradeSubmissionQueries.update(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['grade-submission', data.id] });
    },
  });
}

/**
 * Submit a grade submission for validation
 */
export function useSubmitGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitGradeSubmissionInput) =>
      gradeSubmissionQueries.submit(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['grade-submission', data.id] });
    },
  });
}

/**
 * Approve a grade submission
 */
export function useApproveGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApproveGradeSubmissionInput) =>
      gradeSubmissionQueries.approve(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['grade-submission', data.id] });
    },
  });
}

/**
 * Reject a grade submission
 */
export function useRejectGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RejectGradeSubmissionInput) =>
      gradeSubmissionQueries.reject(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['grade-submission', data.id] });
    },
  });
}

/**
 * Delete a grade submission
 */
export function useDeleteGradeSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => gradeSubmissionQueries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-submissions'] });
    },
  });
}

// ============================================================================
// COMBINED HOOKS
// ============================================================================

/**
 * Get grade with its version history
 */
export function useGradeWithVersions(gradeId: string) {
  const grade = useGrade(gradeId);
  const versions = useGradeVersions(gradeId);

  return {
    grade: grade.data,
    versions: versions.data,
    isLoading: grade.isLoading || versions.isLoading,
    error: grade.error || versions.error,
  };
}

/**
 * Get student grades with summary
 */
export function useStudentGradesWithSummary(studentId: string, periodId?: string) {
  const grades = useStudentGrades(studentId, periodId);
  const summary = useStudentGradeSummary(studentId, periodId || '');

  return {
    grades: grades.data,
    summary: summary.data,
    isLoading: grades.isLoading || summary.isLoading,
    error: grades.error || summary.error,
  };
}
