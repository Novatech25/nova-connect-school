import { z } from "zod";

// ============================================
// USER CAMPUS ACCESS
// ============================================

export const accessTypeSchema = z.enum([
  "full_access",
  "restricted",
  "read_only",
]);

export const userCampusAccessSchema = z
  .object({
    id: z.string().uuid(),
    schoolId: z.string().uuid(),
    userId: z.string().uuid(),
    campusId: z.string().uuid(),
    canAccess: z.boolean().default(true),
    accessType: accessTypeSchema,
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  });

export const createUserCampusAccessSchema = z.object({
  schoolId: z.string().uuid(),
  userId: z.string().uuid(),
  campusId: z.string().uuid(),
  canAccess: z.boolean().default(true),
  accessType: accessTypeSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const updateUserCampusAccessSchema = userCampusAccessSchema
  .partial()
  .required({
    id: true,
  });

// ============================================
// CAMPUS SCHEDULES
// ============================================

export const campusScheduleSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  campusId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  specificConstraints: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createCampusScheduleSchema = z.object({
  schoolId: z.string().uuid(),
  campusId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  specificConstraints: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCampusScheduleSchema = campusScheduleSchema.partial().required({
  id: true,
});

// ============================================
// CAMPUS LOCATION VALIDATION
// ============================================

export const campusActionSchema = z.enum([
  "attendance",
  "lesson_log",
  "qr_scan",
]);

export const campusLocationValidationSchema = z.object({
  campusId: z.string().uuid(),
  userLat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  userLon: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  action: campusActionSchema,
});

export const campusLocationValidationRequestSchema = z.object({
  schoolId: z.string().uuid(),
  campusId: z.string().uuid(),
  userLat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  userLon: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  userId: z.string().uuid().optional(),
  action: campusActionSchema,
});

export const campusLocationValidationSuccessSchema = z.object({
  valid: z.literal(true),
  distance: z.number(),
  campus: z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string(),
    address: z.string(),
    radiusMeters: z.number(),
  }),
  message: z.string(),
});

export const campusLocationValidationErrorSchema = z.object({
  valid: z.literal(false),
  error: z.enum([
    "out_of_range",
    "campus_not_found",
    "access_denied",
    "multi_campus_not_enabled",
    "invalid_coordinates",
  ]),
  message: z.string(),
  distance: z.number().optional(),
  campus: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      code: z.string(),
      address: z.string(),
      radiusMeters: z.number(),
    })
    .optional(),
});

export const campusLocationValidationResponseSchema = z.discriminatedUnion(
  "valid",
  [campusLocationValidationSuccessSchema, campusLocationValidationErrorSchema]
);

// ============================================
// CAMPUS REPORTS
// ============================================

export const reportTypeSchema = z.enum([
  "attendance",
  "grades",
  "payments",
  "schedule",
]);

export const campusReportRequestSchema = z
  .object({
    schoolId: z.string().uuid(),
    campusId: z.string().uuid(),
    reportType: reportTypeSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be after or equal to start date",
    path: ["endDate"],
  });

export const campusReportSuccessResponseSchema = z.object({
  success: z.literal(true),
  reportType: z.string(),
  campus: z.object({
    id: z.string().uuid(),
    name: z.string(),
    code: z.string(),
  }),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  data: z.record(z.unknown()),
  generatedAt: z.string(),
});

export const campusReportErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.enum([
    "multi_campus_not_enabled",
    "access_denied",
    "invalid_report_type",
    "campus_not_found",
    "invalid_date_range",
  ]),
  message: z.string(),
});

export const campusReportResponseSchema = z.discriminatedUnion("success", [
  campusReportSuccessResponseSchema,
  campusReportErrorResponseSchema,
]);

// ============================================
// CAMPUS CONTEXT
// ============================================

export const campusContextSchema = z.object({
  isEnabled: z.boolean(),
  campuses: z.array(
    z.object({
      id: z.string().uuid(),
      schoolId: z.string().uuid(),
      name: z.string(),
      code: z.string(),
      address: z.string().optional(),
      city: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      radiusMeters: z.number(),
      isMain: z.boolean(),
      createdAt: z.coerce.date(),
      updatedAt: z.coerce.date(),
    })
  ),
  licenseType: z.string().optional(),
  error: z.string().optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type AccessType = z.infer<typeof accessTypeSchema>;
export type UserCampusAccess = z.infer<typeof userCampusAccessSchema>;
export type CreateUserCampusAccess = z.infer<typeof createUserCampusAccessSchema>;
export type UpdateUserCampusAccess = z.infer<typeof updateUserCampusAccessSchema>;

export type CampusSchedule = z.infer<typeof campusScheduleSchema>;
export type CreateCampusSchedule = z.infer<typeof createCampusScheduleSchema>;
export type UpdateCampusSchedule = z.infer<typeof updateCampusScheduleSchema>;

export type CampusAction = z.infer<typeof campusActionSchema>;
export type CampusLocationValidation = z.infer<typeof campusLocationValidationSchema>;
export type CampusLocationValidationRequest = z.infer<typeof campusLocationValidationRequestSchema>;
export type CampusLocationValidationSuccess = z.infer<
  typeof campusLocationValidationSuccessSchema
>;
export type CampusLocationValidationError = z.infer<
  typeof campusLocationValidationErrorSchema
>;
export type CampusLocationValidationResponse = z.infer<
  typeof campusLocationValidationResponseSchema
>;

export type ReportType = z.infer<typeof reportTypeSchema>;
export type CampusReportRequest = z.infer<typeof campusReportRequestSchema>;
export type CampusReportSuccessResponse = z.infer<
  typeof campusReportSuccessResponseSchema
>;
export type CampusReportErrorResponse = z.infer<
  typeof campusReportErrorResponseSchema
>;
export type CampusReportResponse = z.infer<typeof campusReportResponseSchema>;

export type CampusContext = z.infer<typeof campusContextSchema>;
