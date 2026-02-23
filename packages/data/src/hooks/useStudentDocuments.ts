import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentDocumentQueries } from '../queries/studentDocuments';

export function useStudentDocuments(studentId: string) {
  return useQuery(studentDocumentQueries.getByStudent(studentId));
}

export function useStudentDocumentDownload() {
  const { mutationFn } = studentDocumentQueries.getSignedUrl();
  return useMutation({
    mutationFn: async ({ documentId, studentId }: { documentId: string; studentId: string }) => {
      return await mutationFn(documentId, studentId);
    },
  });
}

export function useStudentDocumentUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentDocumentQueries.upload(),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student_documents', variables.studentId] });
    },
  });
}

export function useStudentDocumentDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentDocumentQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_documents'] });
    },
  });
}
