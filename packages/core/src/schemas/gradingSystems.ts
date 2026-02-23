import { z } from "zod";

// ============================================
// GRADING SYSTEMS SCHEMAS
// ============================================

export const systemTypeEnum = z.enum(['points_0_10', 'points_0_20', 'credits_ects', 'credits_skills', 'grade_points', 'pass_fail']);
export type SystemTypeEnum = z.infer<typeof systemTypeEnum>;

export const gradingSystemScaleConfigSchema = z.object({
  A: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
    gpa: z.number().optional(),
    credits: z.boolean().optional(),
    skills: z.string().optional(),
  }).optional(),
  B: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
    gpa: z.number().optional(),
    credits: z.boolean().optional(),
    skills: z.string().optional(),
  }).optional(),
  C: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
    gpa: z.number().optional(),
    credits: z.boolean().optional(),
    skills: z.string().optional(),
  }).optional(),
  D: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
    gpa: z.number().optional(),
    credits: z.boolean().optional(),
    skills: z.string().optional(),
  }).optional(),
  F: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
    gpa: z.number().optional(),
    credits: z.boolean().optional(),
    skills: z.string().optional(),
  }).optional(),
  TB: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
  }).optional(),
  AB: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
  }).optional(),
  PP: z.object({
    min: z.number(),
    max: z.number(),
    label: z.string().optional(),
    mention: z.string().optional(),
  }).optional(),
});

export type GradingSystemScaleConfig = z.infer<typeof gradingSystemScaleConfigSchema>;

export const createGradingSystemSchema = z.object({
  schoolId: z.string().uuid().optional(),
  levelId: z.string().uuid().optional(),
  name: z.string().min(1, "Le nom est requis"),
  systemType: systemTypeEnum,
  maxScore: z.number().min(0).max(100).default(20),
  minPassingScore: z.number().min(0).max(100).default(10),
  passingGrade: z.string().default("10"),
  maxGpa: z.number().min(0).max(10).default(4.0).optional(),
  gradeScaleConfig: gradingSystemScaleConfigSchema,
  minCreditsToPass: z.number().min(0).default(0).optional(),
  totalCreditsRequired: z.number().min(0).default(0).optional(),
  isLevelSpecific: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CreateGradingSystemSchema = z.infer<typeof createGradingSystemSchema>;

export const updateGradingSystemSchema = createGradingSystemSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateGradingSystemSchema = z.infer<typeof updateGradingSystemSchema>;

// ============================================
// QUICK SETUP SCHEMAS (for convenience)
// ============================================

export const quickSetupPrimarySchema = z.object({
  schoolId: z.string().uuid(),
  levelId: z.string().uuid(),
  scaleName: z.string().default("Échelle Primaire (0-10)"),
});

export const quickSetupSecondarySchema = z.object({
  schoolId: z.string().uuid(),
  levelId: z.string().uuid(),
  scaleName: z.string().default("Échelle Secondaire (0-20)"),
});

export const quickSetupUniversitySchema = z.object({
  schoolId: z.string().uuid(),
  levelId: z.string().uuid(),
  totalCredits: z.number().min(1),
  passingGpa: z.number().min(0).max(4).default(2.0),
  scaleName: z.string().default("Université - Crédits ECTS"),
});

export const quickSetupVocationalSchema = z.object({
  schoolId: z.string().uuid(),
  levelId: z.string().uuid(),
  totalCredits: z.number().min(1),
  scaleName: z.string().default("Formation Professionnelle"),
});
