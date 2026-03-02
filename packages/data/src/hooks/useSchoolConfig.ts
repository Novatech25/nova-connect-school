import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  academicYearQueries,
  levelQueries,
  classQueries,
  subjectQueries,
  periodQueries,
  gradingScaleQueries,
  roomQueries,
  teacherAssignmentQueries,
  subjectCategoryQueries,
} from "../queries/schoolConfig";
import { campusQueries } from "../queries/multiCampus";

// ============================================
// ACADEMIC YEARS
// ============================================

export function useAcademicYears(schoolId: string) {
  return useQuery({
    ...academicYearQueries.getAll(schoolId),
    enabled: !!schoolId,
  });
}

export function useCurrentAcademicYear(schoolId: string) {
  return useQuery({
    ...academicYearQueries.getCurrent(schoolId),
    enabled: !!schoolId,
  });
}

export function useAcademicYear(id: string) {
  return useQuery(academicYearQueries.getById(id));
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    ...academicYearQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_years"] });
    },
  });
}

export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    ...academicYearQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_years"] });
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    ...academicYearQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_years"] });
    },
  });
}

// ============================================
// LEVELS
// ============================================

export function useLevels(schoolId: string) {
  return useQuery(levelQueries.getAll(schoolId));
}

export function useLevelsByType(schoolId: string, levelType: string) {
  return useQuery(levelQueries.getByType(schoolId, levelType));
}

export function useCreateLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    ...levelQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["levels"] });
    },
  });
}

export function useUpdateLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    ...levelQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["levels"] });
    },
  });
}

export function useDeleteLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    ...levelQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["levels"] });
    },
  });
}

// ============================================
// CLASSES
// ============================================

export function useClasses(schoolId: string, academicYearId?: string) {
  return useQuery(classQueries.getAll(schoolId, academicYearId));
}

export function useClass(id: string) {
  return useQuery(classQueries.getById(id));
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    ...classQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    ...classQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  return useMutation({
    ...classQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

// ============================================
// SUBJECTS
// ============================================

export function useSubjects(schoolId: string, levelId?: string) {
  return useQuery(subjectQueries.getAll(schoolId, levelId));
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    ...subjectQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    ...subjectQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    ...subjectQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });
}

// ============================================
// SUBJECT CATEGORIES (UE)
// ============================================

export function useSubjectCategories(schoolId: string) {
  return useQuery(subjectCategoryQueries.getAll(schoolId));
}

export function useCreateSubjectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    ...subjectCategoryQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject_categories"] });
    },
  });
}

export function useUpdateSubjectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    ...subjectCategoryQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject_categories"] });
    },
  });
}

export function useDeleteSubjectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    ...subjectCategoryQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject_categories"] });
    },
  });
}

// ============================================
// PERIODS
// ============================================

export function usePeriods(schoolId: string, academicYearId: string, options?: Partial<any>) {
  return useQuery({
    ...periodQueries.getAll(schoolId, academicYearId),
    ...options,
  });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    ...periodQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
  });
}

export function useUpdatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    ...periodQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
  });
}

export function useDeletePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    ...periodQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] });
    },
  });
}

// ============================================
// GRADING SCALES
// ============================================

export function useGradingScales(schoolId: string) {
  return useQuery(gradingScaleQueries.getAll(schoolId));
}

export function useDefaultGradingScale(schoolId: string) {
  return useQuery(gradingScaleQueries.getDefault(schoolId));
}

export function useCreateGradingScale() {
  const queryClient = useQueryClient();
  return useMutation({
    ...gradingScaleQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_scales"] });
    },
  });
}

export function useUpdateGradingScale() {
  const queryClient = useQueryClient();
  return useMutation({
    ...gradingScaleQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_scales"] });
    },
  });
}

export function useDeleteGradingScale() {
  const queryClient = useQueryClient();
  return useMutation({
    ...gradingScaleQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grading_scales"] });
    },
  });
}

// ============================================
// CAMPUSES
// ============================================

export function useCampuses(schoolId: string) {
  return useQuery(campusQueries.getAll(schoolId));
}

export function useMainCampus(schoolId: string) {
  return useQuery(campusQueries.getMain(schoolId));
}

export function useCreateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...campusQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campuses"] });
    },
  });
}

export function useUpdateCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...campusQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campuses"] });
    },
  });
}

export function useDeleteCampus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...campusQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campuses"] });
    },
  });
}

// ============================================
// ROOMS
// ============================================

export function useRooms(schoolId: string, campusId?: string) {
  return useQuery(roomQueries.getAll(schoolId, campusId));
}

export function useAvailableRooms(schoolId: string, campusId?: string) {
  return useQuery(roomQueries.getAvailable(schoolId, campusId));
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    ...roomQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    ...roomQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    ...roomQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
}

// ============================================
// TEACHER ASSIGNMENTS
// ============================================

export function useTeacherAssignments(
  schoolId: string,
  academicYearId?: string
) {
  return useQuery(teacherAssignmentQueries.getAll(schoolId, academicYearId));
}

export function useTeacherAssignmentsByTeacher(
  teacherId: string,
  academicYearId?: string
) {
  return useQuery({
    ...teacherAssignmentQueries.getByTeacher(teacherId, academicYearId),
    enabled: !!teacherId,
  });
}

export function useTeacherAssignmentsByClass(classId: string) {
  return useQuery(teacherAssignmentQueries.getByClass(classId));
}

export function useCreateTeacherAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...teacherAssignmentQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher_assignments"] });
    },
  });
}

export function useCreateBulkTeacherAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    ...teacherAssignmentQueries.createBulk(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher_assignments"] });
    },
  });
}

export function useUpdateTeacherAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...teacherAssignmentQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher_assignments"] });
    },
  });
}

export function useDeleteTeacherAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...teacherAssignmentQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher_assignments"] });
    },
  });
}
