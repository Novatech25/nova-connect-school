import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface CreateCompleteParentDataV2 {
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

export function useCreateCompleteParentV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCompleteParentDataV2) => {
      const response = await fetch("/api/parents/create-complete-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create parent account");
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      console.log("[PARENT V2] Parent créé avec succès:", data);
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["parents"] });
      queryClient.invalidateQueries({
        queryKey: ["parents", "student", variables.studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
