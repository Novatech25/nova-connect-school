import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { promotionQueries } from "../queries/promotions";

// ============================================
// PROMOTION HOOKS
// ============================================

export function usePromotionEligibility(schoolId: string, currentYearId: string) {
  return useQuery({
    ...promotionQueries.getEligibility(schoolId, currentYearId),
    enabled: !!schoolId && !!currentYearId,
  });
}

export function useStudentPromotionSummary(studentId: string, currentYearId: string) {
  return useQuery({
    ...promotionQueries.getStudentSummary(studentId, currentYearId),
    enabled: !!studentId && !!currentYearId,
  });
}

export function usePeriodRanking(classId: string, periodId: string) {
  return useQuery(promotionQueries.getPeriodRanking(classId, periodId));
}

export function useBulkPromote() {
  const queryClient = useQueryClient();
  return useMutation({
    ...promotionQueries.bulkPromote(),
    onSuccess: () => {
      // Invalidate relevant queries after promotion
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
