import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface CreateCompleteParentData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  schoolId: string;
  studentId: string;
  relationship: string;
  phone?: string;
  address?: string;
  city?: string;
  occupation?: string;
  workplace?: string;
  isPrimaryContact?: boolean;
  isEmergencyContact?: boolean;
}

export function useCreateCompleteParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCompleteParentData) => {
      const response = await fetch('/api/parents/create-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create parent account');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['parents', 'student', variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
