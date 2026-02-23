import { z } from "zod";
import { roomSizeCategorySchema } from "./roomAssignment";

// ============================================
// ENUMS
// ============================================

export const levelTypeSchema = z.enum([
  "primary",
  "middle_school",
  "high_school",
  "university",
]);

export const periodTypeSchema = z.enum([
  "trimester",
  "semester",
  "composition",
  "exam",
]);

export const roomTypeSchema = z.enum([
  "classroom",
  "lab",
  "amphitheater",
  "library",
  "gym",
  "other",
]);

// ============================================
// ACADEMIC YEARS
// ============================================

const academicYearSchemaBase = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z
    .string()
    .min(1, "Name is required")
    .regex(/^\d{4}-\d{4}$/, "Format must be YYYY-YYYY (e.g., 2024-2025)"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const academicYearSchema = academicYearSchemaBase.refine(
  (data) => data.endDate > data.startDate,
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

export const createAcademicYearSchema = academicYearSchemaBase
  .partial({
    id: true,
    isCurrent: true,
    createdAt: true,
    updatedAt: true,
  })
  .required({
    schoolId: true,
    name: true,
    startDate: true,
    endDate: true,
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const updateAcademicYearSchema = academicYearSchemaBase.partial().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

// ============================================
// LEVELS
// ============================================

export const levelSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  levelType: levelTypeSchema,
  orderIndex: z.number().int().nonnegative("Order index must be non-negative"),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createLevelSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  levelType: levelTypeSchema,
  orderIndex: z.number().int().nonnegative("Order index must be non-negative"),
});

export const updateLevelSchema = levelSchema.partial();

// ============================================
// CLASSES
// ============================================

export const schoolClassSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  levelId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  capacity: z
    .number()
    .int()
    .positive("Capacity must be a positive integer")
    .optional(),
  homeroomTeacherId: z.string().uuid().nullable(),
  roomId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createSchoolClassSchema = z.object({
  schoolId: z.string().uuid(),
  levelId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  capacity: z
    .number()
    .int()
    .positive("Capacity must be a positive integer")
    .optional(),
  homeroomTeacherId: z.string().uuid().nullable(),
  roomId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateSchoolClassSchema = schoolClassSchema.partial();

// ============================================
// SUBJECTS
// ============================================

export const schoolSubjectSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  description: z.string().optional(),
  levelId: z.string().uuid().nullable(),
  coefficient: z.number().positive("Coefficient must be positive").default(1),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex color (e.g., #3b82f6)")
    .optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createSchoolSubjectSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  description: z.string().optional(),
  levelId: z.string().uuid().nullable(),
  coefficient: z.number().positive("Coefficient must be positive").default(1),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex color (e.g., #3b82f6)")
    .optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateSchoolSubjectSchema = schoolSubjectSchema.partial();

// ============================================
// PERIODS
// ============================================

const periodSchemaBase = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  periodType: periodTypeSchema,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  orderIndex: z.number().int().nonnegative("Order index must be non-negative"),
  weight: z.number().positive("Weight must be positive").default(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const periodSchema = periodSchemaBase.refine(
  (data) => data.endDate > data.startDate,
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

export const createPeriodSchema = z
  .object({
    schoolId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    name: z.string().min(1, "Name is required"),
    periodType: periodTypeSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    orderIndex: z.number().int().nonnegative("Order index must be non-negative"),
    weight: z.number().positive("Weight must be positive").default(1),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const updatePeriodSchema = periodSchemaBase.partial().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

// ============================================
// GRADING SCALES
// ============================================

export const gradingMentionSchema = z.object({
  min: z.number().nonnegative("Minimum score must be non-negative"),
  max: z.number().positive("Maximum score must be positive"),
  label: z.string().min(1, "Label is required"),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex color (e.g., #10b981)"),
});

export const gradingScaleConfigSchema = z.object({
  mentions: z.array(gradingMentionSchema),
});

const gradingScaleSchemaBase = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  minScore: z.number().nonnegative("Minimum score must be non-negative"),
  maxScore: z.number().positive("Maximum score must be positive"),
  passingScore: z.number().nonnegative("Passing score must be non-negative"),
  scaleConfig: gradingScaleConfigSchema,
  isDefault: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const gradingScaleSchema = gradingScaleSchemaBase
  .refine(
    (data) =>
      data.passingScore >= data.minScore &&
      data.passingScore <= data.maxScore,
    {
      message: "Passing score must be between min and max score",
      path: ["passingScore"],
    }
  )
  .refine((data) => data.maxScore > data.minScore, {
    message: "Max score must be greater than min score",
    path: ["maxScore"],
  });

export const createGradingScaleSchema = z
  .object({
    schoolId: z.string().uuid(),
    name: z.string().min(1, "Name is required"),
    minScore: z.number().nonnegative("Minimum score must be non-negative"),
    maxScore: z.number().positive("Maximum score must be positive"),
    passingScore: z.number().nonnegative("Passing score must be non-negative"),
    scaleConfig: gradingScaleConfigSchema,
  })
  .refine(
    (data) =>
      data.passingScore >= data.minScore &&
      data.passingScore <= data.maxScore,
    {
      message: "Passing score must be between min and max score",
      path: ["passingScore"],
    }
  )
  .refine((data) => data.maxScore > data.minScore, {
    message: "Max score must be greater than min score",
    path: ["maxScore"],
  });

export const updateGradingScaleSchema = gradingScaleSchemaBase.partial().refine(
  (data) => {
    if (
      data.minScore !== undefined &&
      data.maxScore !== undefined &&
      data.passingScore !== undefined
    ) {
      return (
        data.passingScore >= data.minScore &&
        data.passingScore <= data.maxScore &&
        data.maxScore > data.minScore
      );
    }
    if (data.minScore !== undefined && data.maxScore !== undefined) {
      return data.maxScore > data.minScore;
    }
    if (data.minScore !== undefined && data.passingScore !== undefined) {
      return data.passingScore >= data.minScore;
    }
    if (data.maxScore !== undefined && data.passingScore !== undefined) {
      return data.passingScore <= data.maxScore;
    }
    return true;
  },
  {
    message: "Invalid grading scale values",
    path: ["maxScore"],
  }
);

// ============================================
// CAMPUSES
// ============================================

export const campusSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  address: z.string().optional(),
  city: z.string().optional(),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
  radiusMeters: z
    .number()
    .int()
    .positive("Radius must be a positive integer")
    .default(200),
  isMain: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createCampusSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  address: z.string().optional(),
  city: z.string().optional(),
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
  radiusMeters: z
    .number()
    .int()
    .positive("Radius must be a positive integer")
    .default(200),
  isMain: z.boolean().default(false),
});

export const updateCampusSchema = campusSchema.partial();

// ============================================
// ROOMS
// ============================================

export const roomSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  campusId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  capacity: z
    .number()
    .int()
    .positive("Capacity must be a positive integer")
    .optional(),
  roomType: roomTypeSchema,
  sizeCategory: roomSizeCategorySchema.optional(),
  equipment: z.record(z.unknown()).optional(),
  isAvailable: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createRoomSchema = z.object({
  schoolId: z.string().uuid(),
  campusId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20, "Code must be 20 characters or less"),
  capacity: z
    .number()
    .int()
    .positive("Capacity must be a positive integer")
    .optional(),
  roomType: roomTypeSchema,
  sizeCategory: roomSizeCategorySchema.optional(),
  equipment: z.record(z.unknown()).optional(),
  isAvailable: z.boolean().default(true),
});

export const updateRoomSchema = roomSchema.partial();

// ============================================
// TEACHER ASSIGNMENTS
// ============================================

export const teacherAssignmentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
  hourlyRate: z.number().positive("Hourly rate must be positive").optional(),
  assignedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createTeacherAssignmentSchema = z.object({
  schoolId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  isPrimary: z.boolean().default(false),
  hourlyRate: z.number().positive("Hourly rate must be positive").optional(),
});

export const updateTeacherAssignmentSchema = teacherAssignmentSchema.partial();

// Bulk assignment schema
export const bulkTeacherAssignmentSchema = z.object({
  teacherId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  assignments: z.array(
    z.object({
      classId: z.string().uuid(),
      subjectId: z.string().uuid(),
      isPrimary: z.boolean().optional(),
      hourlyRate: z.number().positive().optional(),
    })
  ),
});

// ============================================
// EXPORTS
// ============================================

export type LevelType = z.infer<typeof levelTypeSchema>;
export type PeriodType = z.infer<typeof periodTypeSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;

export type AcademicYear = z.infer<typeof academicYearSchema>;
export type CreateAcademicYear = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYear = z.infer<typeof updateAcademicYearSchema>;

export type Level = z.infer<typeof levelSchema>;
export type CreateLevel = z.infer<typeof createLevelSchema>;
export type UpdateLevel = z.infer<typeof updateLevelSchema>;

export type SchoolClass = z.infer<typeof schoolClassSchema>;
export type CreateSchoolClass = z.infer<typeof createSchoolClassSchema>;
export type UpdateSchoolClass = z.infer<typeof updateSchoolClassSchema>;

export type SchoolSubject = z.infer<typeof schoolSubjectSchema>;
export type CreateSchoolSubject = z.infer<typeof createSchoolSubjectSchema>;
export type UpdateSchoolSubject = z.infer<typeof updateSchoolSubjectSchema>;

export type Period = z.infer<typeof periodSchema>;
export type CreatePeriod = z.infer<typeof createPeriodSchema>;
export type UpdatePeriod = z.infer<typeof updatePeriodSchema>;

export type GradingMention = z.infer<typeof gradingMentionSchema>;
export type GradingScaleConfig = z.infer<typeof gradingScaleConfigSchema>;
export type GradingScale = z.infer<typeof gradingScaleSchema>;
export type CreateGradingScale = z.infer<typeof createGradingScaleSchema>;
export type UpdateGradingScale = z.infer<typeof updateGradingScaleSchema>;

export type Campus = z.infer<typeof campusSchema>;
export type CreateCampus = z.infer<typeof createCampusSchema>;
export type UpdateCampus = z.infer<typeof updateCampusSchema>;

export type Room = z.infer<typeof roomSchema>;
export type CreateRoom = z.infer<typeof createRoomSchema>;
export type UpdateRoom = z.infer<typeof updateRoomSchema>;

export type TeacherAssignment = z.infer<typeof teacherAssignmentSchema>;
export type CreateTeacherAssignment = z.infer<typeof createTeacherAssignmentSchema>;
export type UpdateTeacherAssignment = z.infer<typeof updateTeacherAssignmentSchema>;
export type BulkTeacherAssignment = z.infer<typeof bulkTeacherAssignmentSchema>;
