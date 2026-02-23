import { getSupabaseClient } from "../client";
import type {
  PromotionEligibility,
  StudentPromotionSummary,
  BulkPromotionRequest,
  BulkPromotionResult,
  BulkPromotionResultItem,
} from "@novaconnect/core";

// ============================================
// PROMOTION QUERIES
// ============================================

export const promotionQueries = {
  // Get promotion eligibility for all students in a school
  getEligibility: (schoolId: string, currentYearId: string) => ({
    queryKey: ["promotions", "eligibility", schoolId, currentYearId],
    queryFn: async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc("get_promotion_eligibility", {
        p_school_id: schoolId,
        p_current_year_id: currentYearId,
      });

      if (error) throw error;
      return data as PromotionEligibility[];
    },
  }),

  // Get promotion summary for a specific student
  getStudentSummary: (studentId: string, currentYearId: string) => ({
    queryKey: ["promotions", "summary", studentId, currentYearId],
    queryFn: async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc("get_student_promotion_summary", {
        p_student_id: studentId,
        p_current_year_id: currentYearId,
      });

      if (error) throw error;
      return data as StudentPromotionSummary[];
    },
  }),

  // Bulk promote students
  bulkPromote: () => ({
    mutationFn: async (request: BulkPromotionRequest) => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc("promote_students_bulk", {
        p_school_id: request.schoolId,
        p_current_year_id: request.currentYearId,
        p_next_year_id: request.nextYearId,
        p_promotions: request.promotions,
      });

      if (error) throw error;

      // Process results
      const results = data as BulkPromotionResultItem[];
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        total: results.length,
        successful,
        failed,
        results,
      } as BulkPromotionResult;
    },
  }),
};

// ============================================
// PROMOTION HELPERS
// ============================================

/**
 * Filter promotion eligibility by criteria
 */
export function filterEligibility(
  eligibility: PromotionEligibility[],
  criteria: {
    status?: string[];
    levelId?: string;
    classId?: string;
    minAverage?: number;
    maxAverage?: number;
    hasEnrollmentNextYear?: boolean;
    searchQuery?: string;
  }
): PromotionEligibility[] {
  let filtered = [...eligibility];

  if (criteria.status && criteria.status.length > 0) {
    filtered = filtered.filter((item) => {
      // Filter by suggestion text from SQL function
      if (criteria.status?.includes("eligible") && item.suggestion === "Promouvoir") return true;
      if (criteria.status?.includes("borderline") && item.suggestion === "À considérer") return true;
      if (criteria.status?.includes("failing") && item.suggestion === "Redoublement conseillé") return true;
      if (criteria.status?.includes("pending") && item.suggestion === "En attente des notes") return true;
      return false;
    });
  }

  if (criteria.levelId) {
    filtered = filtered.filter((item) => item.currentLevelId === criteria.levelId);
  }

  if (criteria.classId) {
    filtered = filtered.filter((item) => item.currentClassId === criteria.classId);
  }

  if (criteria.minAverage !== undefined) {
    filtered = filtered.filter(
      (item) => item.finalAverage !== null && item.finalAverage >= criteria.minAverage!
    );
  }

  if (criteria.maxAverage !== undefined) {
    filtered = filtered.filter(
      (item) => item.finalAverage !== null && item.finalAverage <= criteria.maxAverage!
    );
  }

  if (criteria.hasEnrollmentNextYear !== undefined) {
    filtered = filtered.filter((item) => item.hasEnrollmentNextYear === criteria.hasEnrollmentNextYear);
  }

  if (criteria.searchQuery) {
    const query = criteria.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.studentFirstName.toLowerCase().includes(query) ||
        item.studentLastName.toLowerCase().includes(query) ||
        item.studentMatricule?.toLowerCase().includes(query)
    );
  }

  return filtered;
}

/**
 * Group students by promotion suggestion
 */
export function groupBySuggestion(eligibility: PromotionEligibility[]) {
  return {
    promote: eligibility.filter((e) => e.suggestion === "Promouvoir"),
    borderline: eligibility.filter((e) => e.suggestion === "À considérer"),
    repeat: eligibility.filter((e) => e.suggestion === "Redoublement conseillé"),
    pending: eligibility.filter((e) => e.suggestion === "En attente des notes"),
    alreadyEnrolled: eligibility.filter((e) => e.hasEnrollmentNextYear),
  };
}

/**
 * Calculate promotion statistics
 */
export function calculatePromotionStats(eligibility: PromotionEligibility[]) {
  const total = eligibility.length;
  const eligible = eligibility.filter((e) => e.isEligibleForPromotion).length;
  const notEligible = eligibility.filter((e) => !e.isEligibleForPromotion && e.finalAverage !== null).length;
  const pending = eligibility.filter((e) => e.finalAverage === null).length;
  const alreadyEnrolled = eligibility.filter((e) => e.hasEnrollmentNextYear).length;

  return {
    total,
    eligible,
    notEligible,
    pending,
    alreadyEnrolled,
    promotionRate: total > 0 ? (eligible / total) * 100 : 0,
  };
}
