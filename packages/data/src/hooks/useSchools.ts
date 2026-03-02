import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolQueries } from "../queries/schools";

export function useSchools() {
  const queryClient = useQueryClient();

  const schools = useQuery({
    ...schoolQueries.getAll(),
  });

  const createSchool = useMutation({
    ...schoolQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
  });

  const updateSchool = useMutation({
    ...schoolQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
  });

  const deleteSchool = useMutation({
    ...schoolQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
    },
  });

  return {
    schools: schools.data,
    isLoading: schools.isLoading,
    error: schools.error,
    createSchool,
    updateSchool,
    deleteSchool,
  };
}

export function useSchool(id: string) {
  const school = useQuery({
    ...schoolQueries.getById(id),
    enabled: !!id,
  });

  return {
    school: school.data,
    isLoading: school.isLoading,
    error: school.error,
  };
}

export function useSchoolByCode(code: string) {
  const school = useQuery({
    ...schoolQueries.getByCode(code),
    enabled: !!code,
  });

  return {
    school: school.data,
    isLoading: school.isLoading,
    error: school.error,
  };
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    ...schoolQueries.update(),
    onSuccess: (data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: ['schools', variables.id] });
      }
    },
  });
}
