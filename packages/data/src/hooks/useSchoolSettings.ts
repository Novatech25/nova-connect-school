import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolSettingsQueries } from "../queries/schoolSettings";
import type { SchoolSettings } from "@novaconnect/core";

export function useSchoolSettings(schoolId: string) {
  return useQuery({
    ...schoolSettingsQueries.get(schoolId),
    enabled: !!schoolId,
  });
}

export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    ...schoolSettingsQueries.update(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["school_settings", variables.schoolId],
      });
    },
  });
}
