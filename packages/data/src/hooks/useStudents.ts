import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../client";
import { camelToSnakeKeys, snakeToCamelKeys } from "../helpers";
import {
  studentQueries,
  parentQueries,
  studentParentRelationQueries,
  enrollmentQueries,
  studentDocumentLegacyQueries as studentDocumentQueries,
} from "../queries/students";

// ============================================
// STUDENTS
// ============================================

export function useStudents(
  schoolId: string,
  filters?: { status?: string; classId?: string }
) {
  return useQuery(studentQueries.getAll(schoolId, filters));
}

export function useStudent(id: string) {
  return useQuery(studentQueries.getById(id));
}

export function useStudentByMatricule(schoolId: string, matricule: string) {
  return useQuery(studentQueries.getByMatricule(schoolId, matricule));
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentQueries.update(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students", data.id] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useCurrentStudent() {
  return useQuery(studentQueries.getCurrent());
}

export function useEnsureCurrentStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentQueries.ensureCurrentStudent(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["current_student"] });
      return data;
    },
  });
}

// ============================================
// PARENTS
// ============================================

export function useParents(schoolId: string) {
  return useQuery(parentQueries.getAll(schoolId));
}

export function useParent(id: string) {
  return useQuery(parentQueries.getById(id));
}

export function useParentsByStudent(studentId: string) {
  return useQuery(parentQueries.getByStudentId(studentId));
}

export function useCurrentParent() {
  return useQuery(parentQueries.getCurrent());
}

export function useParentByEmail(schoolId: string, email: string) {
  return useQuery(parentQueries.getByEmail(schoolId, email));
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...parentQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    },
  });
}

export function useUpdateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...parentQueries.update(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({ queryKey: ["parents", data.id] });
    },
  });
}

export function useDeleteParent() {
  const queryClient = useQueryClient();
  return useMutation({
    ...parentQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    },
  });
}

// ============================================
// STUDENT-PARENT RELATIONS
// ============================================

export function useCreateStudentParentRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentParentRelationQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    },
  });
}

export function useDeleteStudentParentRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentParentRelationQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["parents"] });
    },
  });
}

// ============================================
// ENROLLMENTS
// ============================================

export function useEnrollments(schoolId: string, academicYearId?: string) {
  return useQuery(enrollmentQueries.getAll(schoolId, academicYearId));
}

export function useEnrollmentsByStudent(studentId: string) {
  return useQuery(enrollmentQueries.getByStudentId(studentId));
}

export function useEnrollmentsByClass(classId: string, options?: any) {
  return useQuery({
    ...enrollmentQueries.getByClassId(classId),
    ...options,
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...enrollmentQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}

export function useUpdateEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...enrollmentQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}

export function useDeleteEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    ...enrollmentQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}

// ============================================
// STUDENT DOCUMENTS
// ============================================

export function useStudentDocuments(studentId: string) {
  return useQuery(studentDocumentQueries.getByStudentId(studentId));
}

export function useCreateStudentDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentDocumentQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student_documents"] });
    },
  });
}

export function useDeleteStudentDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentDocumentQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student_documents"] });
    },
  });
}

// ============================================
// BULK OPERATIONS
// ============================================

export function useBulkEnrollStudents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      schoolId: string;
      classId: string;
      academicYearId: string;
      studentIds: string[];
      enrollmentDate?: Date;
    }) => {
      const supabase = getSupabaseClient();
      const enrollments = data.studentIds.map((studentId) => ({
        school_id: data.schoolId,
        student_id: studentId,
        class_id: data.classId,
        academic_year_id: data.academicYearId,
        enrollment_date: data.enrollmentDate instanceof Date
          ? data.enrollmentDate.toISOString().split('T')[0]
          : (data.enrollmentDate || new Date().toISOString().split('T')[0]),
      }));

      const { data: result, error } = await supabase
        .from("enrollments")
        .insert(enrollments)
        .select();

      if (error) throw error;
      return snakeToCamelKeys(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}

/**
 * Hook to get current user's student ID
 * Returns the student record if the current user is a student
 */
export const useCurrentStudentId = () => {
  const supabase = getSupabaseClient();

  return useQuery({
    queryKey: ['user', 'studentId'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      const { data, error } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no student record found, return null (user might be admin/teacher/parent)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data?.id ?? null;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
