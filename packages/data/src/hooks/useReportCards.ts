import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportCardQueries } from '../queries/reportCards';
import type { ReportCardFilters } from '@novaconnect/core';

export function useReportCards(schoolId: string, filters?: ReportCardFilters) {
  return useQuery(reportCardQueries.getAll(schoolId, filters));
}

export function useReportCard(id: string) {
  return useQuery(reportCardQueries.getById(id));
}

export function useReportCardVersions(reportCardId: string) {
  return useQuery(reportCardQueries.getVersions(reportCardId));
}

export function useGenerateReportCard() {
  const queryClient = useQueryClient();
  return useMutation({
    ...reportCardQueries.generate(),
    onSuccess: (data) => {
      // Invalider la liste generale
      queryClient.invalidateQueries({ queryKey: ['report_cards'] });
      // Invalider le detail du bulletin specifique si on a l'ID
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['report_cards', data.id] });
      }
      // Invalider aussi par studentId/periodId si disponible
      if (data?.studentId && data?.periodId) {
        queryClient.invalidateQueries({ 
          queryKey: ['report_cards', 'student', data.studentId, data.periodId] 
        });
      }
    },
  });
}

export function useGenerateBatchReportCards() {
  const queryClient = useQueryClient();
  return useMutation({
    ...reportCardQueries.generateBatch(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_cards'] });
    },
  });
}

export function usePublishReportCard() {
  const queryClient = useQueryClient();
  return useMutation({
    ...reportCardQueries.publish(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['report_cards'] });
      queryClient.invalidateQueries({ queryKey: ['report_cards', data.id] });
    },
  });
}

export function useOverridePaymentBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    ...reportCardQueries.overridePaymentBlock(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['report_cards'] });
      queryClient.invalidateQueries({ queryKey: ['report_cards', data.id] });
    },
  });
}

export function useExportReportCards() {
  return useMutation(reportCardQueries.export());
}

export function useDeleteReportCard() {
  const queryClient = useQueryClient();
  return useMutation({
    ...reportCardQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report_cards'] });
    },
  });
}

export function useReportCardSignedUrl() {
  return useMutation(reportCardQueries.getSignedUrl());
}

