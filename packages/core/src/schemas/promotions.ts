import { z } from 'zod';

// ============================================
// PROMOTION TYPES
// ============================================

export const promotionSuggestionSchema = z.enum([
  'Promouvoir',
  'Redoublement',
  'À considérer',
  'En attente des notes',
]);

export type PromotionSuggestion = z.infer<typeof promotionSuggestionSchema>;

export const promotionStatusSchema = z.enum([
  'eligible',      // Can be promoted
  'borderline',    // Just below passing, needs review
  'failing',       // Clearly needs to repeat
  'pending',       // Grades not available
  'already_promoted', // Already enrolled next year
  'graduated',     // No higher level available
]);

export type PromotionStatus = z.infer<typeof promotionStatusSchema>;

export const bulkPromotionItemSchema = z.object({
  studentId: z.string().uuid(),
  targetClassId: z.string().uuid(),
  isRepeating: z.boolean(),
  notes: z.string().optional(),
});

export type BulkPromotionItem = z.infer<typeof bulkPromotionItemSchema>;

// ============================================
// PROMOTION ELIGIBILITY
// ============================================

export const promotionEligibilitySchema = z.object({
  studentId: z.string().uuid(),
  studentFirstName: z.string(),
  studentLastName: z.string(),
  studentMatricule: z.string().nullable(),
  currentClassId: z.string().uuid(),
  currentClassName: z.string(),
  currentLevelId: z.string().uuid(),
  currentLevelName: z.string(),
  finalAverage: z.number().nullable(),
  rankInClass: z.number().int().nullable(),
  passingScore: z.number(),
  isEligibleForPromotion: z.boolean(),
  suggestion: z.string(),
  nextLevelId: z.string().uuid().nullable(),
  nextLevelName: z.string().nullable(),
  hasEnrollmentNextYear: z.boolean(),
});

export type PromotionEligibility = z.infer<typeof promotionEligibilitySchema>;

// ============================================
// STUDENT PROMOTION SUMMARY
// ============================================

export const studentPromotionSummarySchema = z.object({
  studentName: z.string(),
  currentClass: z.string(),
  currentLevel: z.string(),
  finalAverage: z.number(),
  rankInClass: z.number().int(),
  classAverage: z.number(),
  promotionStatus: z.string(),
  canPromote: z.boolean(),
  suggestedAction: z.string(),
  nextClassName: z.string().nullable(),
  enrollmentHistory: z.array(z.object({
    year: z.string(),
    class: z.string(),
    level: z.string(),
    isRepeating: z.boolean(),
    status: z.string(),
  })).nullable(),
});

export type StudentPromotionSummary = z.infer<typeof studentPromotionSummarySchema>;

// ============================================
// BULK PROMOTION REQUEST
// ============================================

export const bulkPromotionRequestSchema = z.object({
  schoolId: z.string().uuid(),
  currentYearId: z.string().uuid(),
  nextYearId: z.string().uuid(),
  promotions: z.array(bulkPromotionItemSchema),
  markCurrentAsCompleted: z.boolean().default(true),
  notes: z.string().optional(),
});

export type BulkPromotionRequest = z.infer<typeof bulkPromotionRequestSchema>;

// ============================================
// BULK PROMOTION RESULT
// ============================================

export const bulkPromotionResultItemSchema = z.object({
  success: z.boolean(),
  studentId: z.string().uuid(),
  studentName: z.string(),
  enrollmentId: z.string().uuid().nullable(),
  message: z.string(),
});

export type BulkPromotionResultItem = z.infer<typeof bulkPromotionResultItemSchema>;

export const bulkPromotionResultSchema = z.object({
  total: z.number().int(),
  successful: z.number().int(),
  failed: z.number().int(),
  results: z.array(bulkPromotionResultItemSchema),
});

export type BulkPromotionResult = z.infer<typeof bulkPromotionResultSchema>;

// ============================================
// PROMOTION CRITERIA (for filtering)
// ============================================

export const promotionCriteriaSchema = z.object({
  status: z.array(z.enum(['eligible', 'borderline', 'failing', 'pending'])).optional(),
  levelId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  minAverage: z.number().optional(),
  maxAverage: z.number().optional(),
  hasEnrollmentNextYear: z.boolean().optional(),
  searchQuery: z.string().optional(),
});

export type PromotionCriteria = z.infer<typeof promotionCriteriaSchema>;
