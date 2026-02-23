import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { licenseQueries } from "../queries/licenses";

export function useLicenses(filters?: {
  school_id?: string;
  status?: string;
  license_type?: string;
  search?: string;
  expires_before?: Date;
  expires_after?: Date;
}) {
  const queryClient = useQueryClient();

  const licenses = useQuery({
    ...licenseQueries.getAll(filters),
  });

  const createLicense = useMutation({
    ...licenseQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["license-stats"] });
    },
  });

  const updateLicense = useMutation({
    ...licenseQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
    },
  });

  const revokeLicense = useMutation({
    ...licenseQueries.revoke(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["license-stats"] });
    },
  });

  const deleteLicense = useMutation({
    ...licenseQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["license-stats"] });
    },
  });

  return {
    licenses: licenses.data,
    isLoading: licenses.isLoading,
    error: licenses.error,
    createLicense,
    updateLicense,
    revokeLicense,
    deleteLicense,
  };
}

export function useLicense(id: string) {
  const queryClient = useQueryClient();

  const license = useQuery({
    ...licenseQueries.getById(id),
    enabled: !!id,
  });

  const updateLicense = useMutation({
    ...licenseQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses", id] });
    },
  });

  const revokeLicense = useMutation({
    ...licenseQueries.revoke(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses", id] });
    },
  });

  return {
    license: license.data,
    isLoading: license.isLoading,
    error: license.error,
    updateLicense,
    revokeLicense,
  };
}

export function useLicenseByKey(key: string) {
  const license = useQuery({
    ...licenseQueries.getByKey(key),
    enabled: !!key,
  });

  return {
    license: license.data,
    isLoading: license.isLoading,
    error: license.error,
  };
}

export function useLicensesBySchool(schoolId: string) {
  const licenses = useQuery({
    ...licenseQueries.getBySchool(schoolId),
    enabled: !!schoolId,
  });

  return {
    licenses: licenses.data,
    isLoading: licenses.isLoading,
    error: licenses.error,
  };
}

export function useLicenseActivations(licenseId: string) {
  const activations = useQuery({
    ...licenseQueries.getActivations(licenseId),
    enabled: !!licenseId,
  });

  return {
    activations: activations.data,
    isLoading: activations.isLoading,
    error: activations.error,
  };
}

export function useLicenseStats() {
  const stats = useQuery({
    ...licenseQueries.getStats(),
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    stats: stats.data,
    isLoading: stats.isLoading,
    error: stats.error,
  };
}
