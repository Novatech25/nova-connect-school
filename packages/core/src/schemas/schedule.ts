import { z } from "zod";

// ============================================
// ENUMS
// ============================================

export const scheduleStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);

export const dayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const constraintTypeSchema = z.enum([
  "teacher_conflict",
  "room_conflict",
  "class_conflict",
  "max_hours_per_day",
  "max_hours_per_week",
  "teacher_availability",
  "teacher_unavailable",
  "outside_availability",
]);

// ============================================
// SCHEDULES
// ============================================

export const scheduleSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1, "Schedule name is required").max(100, "Schedule name must be less than 100 characters"),
  description: z.string().optional(),
  status: scheduleStatusSchema,
  version: z.number().int().positive(),
  publishedAt: z.coerce.date().nullable(),
  publishedBy: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createScheduleSchema = z.object({
  schoolId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1, "Schedule name is required").max(100, "Schedule name must be less than 100 characters"),
  description: z.string().optional(),
  status: scheduleStatusSchema.default("draft"),
  version: z.number().int().positive().default(1),
  metadata: z.record(z.unknown()).optional(),
});

export const updateScheduleSchema = scheduleSchema.partial().required({ id: true });

// ============================================
// SCHEDULE SLOTS
// ============================================

// Helper to validate TIME format (HH:MM)
const timeSchema = z.string().regex(/^([0-1]?\d|2[0-3]):[0-5]\d$/, {
  message: "Invalid time format. Expected HH:MM",
});

export const scheduleSlotSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid(),
  schoolId: z.string().uuid(),
  dayOfWeek: dayOfWeekSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  roomId: z.string().uuid().nullable(),
  campusId: z.string().uuid().nullable(),
  isRecurring: z.boolean(),
  recurrenceEndDate: z.coerce.date().nullable(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createScheduleSlotSchema = z.object({
  scheduleId: z.string().uuid(),
  schoolId: z.string().uuid(),
  dayOfWeek: dayOfWeekSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  campusId: z.string().uuid().nullable().optional(),
  isRecurring: z.boolean().default(true),
  recurrenceEndDate: z.coerce.date().nullable().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => {
    // Validate endTime > startTime
    const [startHours = 0, startMinutes = 0] = data.startTime.split(":").map(Number);
    const [endHours = 0, endMinutes = 0] = data.endTime.split(":").map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    return endTotalMinutes > startTotalMinutes;
  },
  {
    message: "End time must be after start time",
    path: ["endTime"],
  }
).refine(
  (data) => {
    // If isRecurring is false, recurrenceEndDate must be null
    // If isRecurring is true, recurrenceEndDate can be null or a date
    if (data.isRecurring === false && data.recurrenceEndDate !== null && data.recurrenceEndDate !== undefined) {
      return false;
    }
    return true;
  },
  {
    message: "recurrenceEndDate must be null when isRecurring is false",
    path: ["recurrenceEndDate"],
  }
);

export const updateScheduleSlotSchema = scheduleSlotSchema.partial().required({ id: true });

export const bulkScheduleSlotsSchema = z.array(createScheduleSlotSchema).min(1, "At least one slot is required");

// ============================================
// SCHEDULE VERSIONS
// ============================================

export const scheduleVersionSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid(),
  schoolId: z.string().uuid(),
  version: z.number().int().positive(),
  snapshotData: z.record(z.unknown()), // Complete JSON snapshot
  changeSummary: z.string().optional(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export const createScheduleVersionSchema = z.object({
  scheduleId: z.string().uuid(),
  schoolId: z.string().uuid(),
  version: z.number().int().positive(),
  snapshotData: z.record(z.unknown()),
  changeSummary: z.string().optional(),
  createdBy: z.string().uuid(),
});

// ============================================
// SCHEDULE CONSTRAINTS
// ============================================

// Base constraint config type - will be refined based on constraint_type
const constraintConfigBaseSchema = z.record(z.unknown());

// Base constraint schema without validation
const baseScheduleConstraintSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  constraintType: constraintTypeSchema,
  constraintConfig: constraintConfigBaseSchema,
  isActive: z.boolean(),
  priority: z.number().int().positive(),
  errorMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const scheduleConstraintSchema = baseScheduleConstraintSchema.superRefine((data, ctx) => {
  // Validate constraint_config based on constraint_type
  const configResult = z
    .discriminatedUnion("constraintType", [
      z.object({
        constraintType: z.literal("teacher_conflict"),
        enabled: z.boolean().optional(),
      }),
      z.object({
        constraintType: z.literal("room_conflict"),
        enabled: z.boolean().optional(),
        allowDoubleBooking: z.boolean().optional(),
      }),
      z.object({
        constraintType: z.literal("class_conflict"),
        enabled: z.boolean().optional(),
      }),
      z.object({
        constraintType: z.literal("max_hours_per_day"),
        maxHours: z.number().positive().max(24),
        breakTime: z.number().min(0).optional(),
      }),
      z.object({
        constraintType: z.literal("max_hours_per_week"),
        maxHours: z.number().positive().max(168),
      }),
      z.object({
        constraintType: z.literal("teacher_availability"),
        requireAvailability: z.boolean().optional(),
        allowOverride: z.boolean().optional(),
      }),
    ])
    .safeParse({ constraintType: data.constraintType, ...data.constraintConfig });

  if (!configResult.success) {
    for (const error of configResult.error.errors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error.message,
        path: [...error.path, "constraintConfig"],
      });
    }
  }
});

export const createScheduleConstraintSchema = z.object({
  schoolId: z.string().uuid(),
  constraintType: constraintTypeSchema,
  constraintConfig: constraintConfigBaseSchema,
  isActive: z.boolean().default(true),
  priority: z.number().int().positive().default(1),
  errorMessage: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validate constraint_config based on constraint_type
  const configResult = z
    .discriminatedUnion("constraintType", [
      z.object({
        constraintType: z.literal("teacher_conflict"),
        enabled: z.boolean().optional(),
      }),
      z.object({
        constraintType: z.literal("room_conflict"),
        enabled: z.boolean().optional(),
        allowDoubleBooking: z.boolean().optional(),
      }),
      z.object({
        constraintType: z.literal("class_conflict"),
        enabled: z.boolean().optional(),
      }),
      z.object({
        constraintType: z.literal("max_hours_per_day"),
        maxHours: z.number().positive().max(24),
        breakTime: z.number().min(0).optional(),
      }),
      z.object({
        constraintType: z.literal("max_hours_per_week"),
        maxHours: z.number().positive().max(168),
      }),
      z.object({
        constraintType: z.literal("teacher_availability"),
        requireAvailability: z.boolean().optional(),
        allowOverride: z.boolean().optional(),
      }),
    ])
    .safeParse({ constraintType: data.constraintType, ...data.constraintConfig });

  if (!configResult.success) {
    for (const error of configResult.error.errors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error.message,
        path: [...error.path, "constraintConfig"],
      });
    }
  }
});

export const updateScheduleConstraintSchema = baseScheduleConstraintSchema.partial().required({ id: true });

// ============================================
// PLANNED SESSIONS
// ============================================

// Base planned session schema without validation
const basePlannedSessionSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  scheduleSlotId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  roomId: z.string().uuid().nullable(),
  sessionDate: z.coerce.date(),
  startTime: timeSchema,
  endTime: timeSchema,
  durationMinutes: z.number().int().positive(),
  isCompleted: z.boolean(),
  isCancelled: z.boolean(),
  cancellationReason: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const plannedSessionSchema = basePlannedSessionSchema
  .refine(
    (data) => {
      // Validate endTime > startTime
      const [startHours = 0, startMinutes = 0] = data.startTime.split(":").map(Number);
      const [endHours = 0, endMinutes = 0] = data.endTime.split(":").map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      return endTotalMinutes > startTotalMinutes;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      // Validate that durationMinutes matches the time difference
      const [startHours = 0, startMinutes = 0] = data.startTime.split(":").map(Number);
      const [endHours = 0, endMinutes = 0] = data.endTime.split(":").map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      const expectedDuration = endTotalMinutes - startTotalMinutes;
      return data.durationMinutes === expectedDuration;
    },
    {
      message: "Duration minutes must match the time difference between start and end",
      path: ["durationMinutes"],
    }
  )
  .refine(
    (data) => {
      // Cannot have both isCompleted and isCancelled true
      return !(data.isCompleted && data.isCancelled);
    },
    {
      message: "Session cannot be both completed and cancelled",
      path: ["isCancelled"],
    }
  );

export const createPlannedSessionSchema = z.object({
  schoolId: z.string().uuid(),
  scheduleSlotId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  sessionDate: z.coerce.date(),
  startTime: timeSchema,
  endTime: timeSchema,
  durationMinutes: z.number().int().positive(),
  isCompleted: z.boolean().default(false),
  isCancelled: z.boolean().default(false),
  cancellationReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})
  .refine(
    (data) => {
      // Validate endTime > startTime
      const [startHours = 0, startMinutes = 0] = data.startTime.split(":").map(Number);
      const [endHours = 0, endMinutes = 0] = data.endTime.split(":").map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      return endTotalMinutes > startTotalMinutes;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      // Cannot have both isCompleted and isCancelled true
      return !(data.isCompleted && data.isCancelled);
    },
    {
      message: "Session cannot be both completed and cancelled",
      path: ["isCancelled"],
    }
  );

export const updatePlannedSessionSchema = basePlannedSessionSchema.partial().required({ id: true });

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

// Publish schedule request
export const publishScheduleRequestSchema = z.object({
  scheduleId: z.string().uuid(),
  notifyUsers: z.boolean().default(false),
});

// Publish schedule response
export const publishScheduleResponseSchema = z.object({
  success: z.boolean(),
  schedule: scheduleSchema,
  sessionsCreated: z.number().int().nonnegative(),
  violations: z.array(z.object({
    type: constraintTypeSchema,
    severity: z.enum(["error", "warning"]),
    message: z.string(),
    affectedSlots: z.array(z.string().uuid()),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
  error: z.string().optional(),
});

// ============================================
// TypeScript Types
// ============================================

export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export type ConstraintType = z.infer<typeof constraintTypeSchema>;

export type Schedule = z.infer<typeof scheduleSchema>;
export type CreateSchedule = z.infer<typeof createScheduleSchema>;
export type UpdateSchedule = z.infer<typeof updateScheduleSchema>;

export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export type CreateScheduleSlot = z.infer<typeof createScheduleSlotSchema>;
export type UpdateScheduleSlot = z.infer<typeof updateScheduleSlotSchema>;

export type ScheduleVersion = z.infer<typeof scheduleVersionSchema>;
export type CreateScheduleVersion = z.infer<typeof createScheduleVersionSchema>;

export type ScheduleConstraint = z.infer<typeof scheduleConstraintSchema>;
export type CreateScheduleConstraint = z.infer<typeof createScheduleConstraintSchema>;
export type UpdateScheduleConstraint = z.infer<typeof updateScheduleConstraintSchema>;

export type PlannedSession = z.infer<typeof plannedSessionSchema>;
export type CreatePlannedSession = z.infer<typeof createPlannedSessionSchema>;
export type UpdatePlannedSession = z.infer<typeof updatePlannedSessionSchema>;

export type PublishScheduleRequest = z.infer<typeof publishScheduleRequestSchema>;
export type PublishScheduleResponse = z.infer<typeof publishScheduleResponseSchema>;
