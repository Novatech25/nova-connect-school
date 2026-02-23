import { useQuery } from '@tanstack/react-query';
import { documentAccessLogQueries } from '../queries/documentAccessLogs';
import type { DocumentAccessFilters } from '@novaconnect/core';

export function useDocumentAccessLogs(schoolId: string, filters?: DocumentAccessFilters) {
  return useQuery(documentAccessLogQueries.getAll(schoolId, filters));
}

export function useBlockedAccessAttempts(schoolId: string) {
  return useQuery(documentAccessLogQueries.getBlockedAttempts(schoolId));
}

export function useDocumentAccessStats(schoolId: string) {
  return useQuery(documentAccessLogQueries.getStats(schoolId));
}
