import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cardTemplateQueries, studentCardQueries } from '../queries/studentCards';
import type {
  CreateCardTemplate,
  UpdateCardTemplate,
  CreateStudentCard,
  UpdateStudentCard,
  RevokeCard,
  GenerateCardBatch,
  GenerateCardPdf,
  OverrideCardPaymentStatus,
} from '@novaconnect/core';

// Card Templates
export function useCardTemplates(schoolId: string) {
  return useQuery(cardTemplateQueries.getAll(schoolId));
}

export function useCardTemplate(id: string) {
  return useQuery(cardTemplateQueries.getById(id));
}

export function useDefaultCardTemplate(schoolId: string) {
  return useQuery(cardTemplateQueries.getDefault(schoolId));
}

export function useCreateCardTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    ...cardTemplateQueries.create(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['card_templates'] });
    },
  });
}

export function useUpdateCardTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    ...cardTemplateQueries.update(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['card_templates'] });
    },
  });
}

export function useDeleteCardTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    ...cardTemplateQueries.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card_templates'] });
    },
  });
}

// Student Cards
export function useStudentCards(
  schoolId: string,
  filters?: { status?: string; studentId?: string }
) {
  return useQuery(studentCardQueries.getAll(schoolId, filters));
}

export function useStudentCard(id: string) {
  return useQuery(studentCardQueries.getById(id));
}

export function useStudentCardsByStudent(studentId: string) {
  return useQuery(studentCardQueries.getByStudentId(studentId));
}

export function useActiveStudentCard(studentId: string) {
  return useQuery(studentCardQueries.getActiveByStudentId(studentId));
}

export function useStudentCardStatistics(schoolId: string) {
  return useQuery(studentCardQueries.getStatistics(schoolId));
}

export function useCreateStudentCard() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentCardQueries.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_cards'] });
    },
  });
}

export function useUpdateStudentCard() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentCardQueries.update(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_cards'] });
    },
  });
}

export function useGenerateStudentCardPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentCardQueries.generatePdf(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_cards'] });
    },
  });
}

export function useGenerateStudentCardsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentCardQueries.generateBatch(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_cards'] });
    },
  });
}

export function useRevokeStudentCard() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentCardQueries.revoke(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_cards'] });
    },
  });
}

export function useOverrideCardPaymentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    ...studentCardQueries.overridePaymentStatus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_cards'] });
    },
  });
}

export function useDownloadStudentCardPdf() {
  return useMutation(studentCardQueries.downloadPdf());
}
