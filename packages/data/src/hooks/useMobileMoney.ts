// ============================================================================
// Mobile Money React Query Hooks
// ============================================================================
// Custom hooks for Mobile Money operations using React Query
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  toggleProvider,
  deleteProvider,
  getTransactions,
  getTransactionById,
  getTransactionsByStudent,
  getStudentFeeSchedules,
  getPendingTransactions,
  getFailedTransactions,
  getTransactionsPendingCheck,
  initiatePayment,
  checkTransactionStatus,
  reconcileManually,
  retryTransaction,
  testProvider,
  getMobileMoneyKpis,
  getGlobalMobileMoneyKpis
} from '../queries/mobileMoney';
import type {
  MobileMoneyProvider,
  MobileMoneyTransaction,
  CreateMobileMoneyProviderInput,
  UpdateMobileMoneyProviderInput,
  InitiateMobileMoneyPaymentInput,
  ReconcileTransactionInput,
  MobileMoneyFilters,
  MobileMoneyKpis
} from '@nova-connect/core';

// ============================================================================
// Provider Hooks
// ============================================================================

/**
 * Hook to get all providers for a school
 */
export function useProviders(schoolId: string) {
  return useQuery({
    queryKey: ['mobile-money', 'providers', schoolId],
    queryFn: () => getProviders(schoolId),
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Alias for useProviders (used in web components)
 */
export function useMobileMoneyProviders(schoolId: string) {
  return useProviders(schoolId);
}

/**
 * Hook to get a specific provider
 */
export function useProvider(id: string) {
  return useQuery({
    queryKey: ['mobile-money', 'provider', id],
    queryFn: () => getProviderById(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a provider
 */
export function useCreateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMobileMoneyProviderInput) => createProvider(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'providers', data.school_id]
      });
    },
  });
}

/**
 * Hook to update a provider
 */
export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMobileMoneyProviderInput }) =>
      updateProvider(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'provider', data.id]
      });
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'providers', data.school_id]
      });
    },
  });
}

/**
 * Hook to toggle provider active status
 */
export function useToggleProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleProvider(id, isActive),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'providers']
      });
    },
  });
}

/**
 * Hook to delete a provider
 */
export function useDeleteProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'providers']
      });
    },
  });
}

// ============================================================================
// Transaction Hooks
// ============================================================================

/**
 * Hook to get transactions with filters
 */
export function useTransactions(
  filters: MobileMoneyFilters,
  page = 1,
  limit = 20
) {
  return useQuery({
    queryKey: ['mobile-money', 'transactions', filters, page, limit],
    queryFn: () => getTransactions(filters, page, limit),
    enabled: !!filters.school_id,
  });
}

/**
 * Alias for useTransactions (used in web components)
 */
export function useMobileMoneyTransactions(
  schoolId: string,
  filters?: Partial<MobileMoneyFilters>,
  page = 1,
  limit = 20
) {
  const fullFilters: MobileMoneyFilters = {
    school_id: schoolId,
    ...filters
  };

  return useQuery({
    queryKey: ['mobile-money', 'transactions', schoolId, filters, page, limit],
    queryFn: () => getTransactions(fullFilters, page, limit),
    enabled: !!schoolId,
  });
}

/**
 * Hook to get a specific transaction
 */
export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['mobile-money', 'transaction', id],
    queryFn: () => getTransactionById(id),
    enabled: !!id,
    refetchInterval: (data) => {
      // Poll for pending transactions every 10 seconds
      if (data?.status === 'pending' || data?.status === 'initiated') {
        return 10000;
      }
      return false;
    },
  });
}

/**
 * Alias for useTransaction (used in web components)
 */
export function useMobileMoneyTransaction(id: string) {
  return useTransaction(id);
}

/**
 * Hook to get transactions for a student
 */
export function useStudentTransactions(studentId: string, academicYearId?: string) {
  return useQuery({
    queryKey: ['mobile-money', 'transactions', 'student', studentId, academicYearId],
    queryFn: () => getTransactionsByStudent(studentId, academicYearId),
    enabled: !!studentId,
  });
}

/**
 * Hook to get fee schedules for a student (Mobile Money context)
 */
export function useMobileMoneyFeeSchedules(studentId: string) {
  return useQuery({
    queryKey: ['fee-schedules', 'student', 'mobile-money', studentId],
    queryFn: () => getStudentFeeSchedules(studentId),
    enabled: !!studentId,
  });
}

/**
 * Hook to get pending transactions (for accountant)
 */
export function usePendingReconciliations(schoolId: string) {
  return useQuery({
    queryKey: ['mobile-money', 'transactions', 'pending', schoolId],
    queryFn: () => getPendingTransactions(schoolId),
    enabled: !!schoolId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to get failed transactions
 */
export function useFailedTransactions(schoolId: string) {
  return useQuery({
    queryKey: ['mobile-money', 'transactions', 'failed', schoolId],
    queryFn: () => getFailedTransactions(schoolId),
    enabled: !!schoolId,
  });
}

/**
 * Hook to get transactions pending status check
 */
export function useTransactionsPendingCheck(schoolId: string) {
  return useQuery({
    queryKey: ['mobile-money', 'transactions', 'pending-check', schoolId],
    queryFn: () => getTransactionsPendingCheck(schoolId),
    enabled: !!schoolId,
    refetchInterval: 60000, // Check every minute
  });
}

// ============================================================================
// Payment Operations Hooks
// ============================================================================

/**
 * Hook to initiate a Mobile Money payment
 */
export function useInitiatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InitiateMobileMoneyPaymentInput) => initiatePayment(input),
    onSuccess: (data, variables) => {
      // Invalidate student transactions
      if (variables.student_id) {
        queryClient.invalidateQueries({
          queryKey: ['mobile-money', 'transactions', 'student', variables.student_id]
        });
      }
    },
  });
}

/**
 * Hook to check transaction status
 */
export function useCheckStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) => checkTransactionStatus({ transaction_id: transactionId }),
    onSuccess: (data) => {
      if (data.transaction_id) {
        queryClient.invalidateQueries({
          queryKey: ['mobile-money', 'transaction', data.transaction_id]
        });
      }
    },
  });
}

/**
 * Hook to manually reconcile a transaction
 */
export function useReconcileManually() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReconcileTransactionInput) => reconcileManually(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'transactions']
      });
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'transactions', 'pending']
      });
    },
  });
}

/**
 * Hook to retry a failed transaction
 */
export function useRetryTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) => retryTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'transactions']
      });
      queryClient.invalidateQueries({
        queryKey: ['mobile-money', 'transactions', 'failed']
      });
    },
  });
}

/**
 * Hook to test a provider connection
 */
export function useTestProvider() {
  return useMutation({
    mutationFn: (providerId: string) => testProvider(providerId),
  });
}

// ============================================================================
// KPIs Hook
// ============================================================================

/**
 * Hook to get Mobile Money KPIs
 */
export function useMobileMoneyKpis(
  schoolId: string,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ['mobile-money', 'kpis', schoolId, dateFrom, dateTo],
    queryFn: () => getMobileMoneyKpis(schoolId, dateFrom, dateTo),
    enabled: !!schoolId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to get global Mobile Money KPIs (super admin)
 */
export function useGlobalMobileMoneyKpis(
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ['mobile-money', 'global-kpis', dateFrom, dateTo],
    queryFn: () => getGlobalMobileMoneyKpis(dateFrom, dateTo),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
