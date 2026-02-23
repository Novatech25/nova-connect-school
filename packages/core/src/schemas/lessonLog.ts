import { z } from 'zod';
import { isValidCoordinates } from '../utils/geolocation';

// ============================================================================
// ENUMS
// ============================================================================

export const lessonLogStatusSchema = z.enum(['draft', 'pending_validation', 'validated', 'rejected']);

export type LessonLogStatus = z.infer<typeof lessonLogStatusSchema>;

// ============================================================================
// LESSON LOGS
// ============================================================================

export const lessonLogSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  plannedSessionId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  theme: z.string().min(3).max(200),
  content: z.string().min(10),
  homework: z.string().nullable(),
  durationMinutes: z.number().int().min(15).max(300),
  status: lessonLogStatusSchema,
  submittedAt: z.string().datetime().nullable(),
  validatedAt: z.string().datetime().nullable(),
  validatedBy: z.string().uuid().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  wifiSsid: z.string().max(100).nullable(),
  deviceInfo: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LessonLog = z.infer<typeof lessonLogSchema>;

export const createLessonLogSchema = z.object({
  schoolId: z.string().uuid(),
  plannedSessionId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: z.string().min(3, 'Theme must be at least 3 characters').max(200, 'Theme must not exceed 200 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  homework: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(15, 'Duration must be at least 15 minutes').max(300, 'Duration must not exceed 300 minutes'),
  latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
  longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  wifiSsid: z.string().max(100).nullable().optional(),
  deviceInfo: z.record(z.any()).optional().default({}),
  metadata: z.record(z.any()).optional().default({}),
}).refine(
  (data) => isValidCoordinates(data.latitude, data.longitude),
  {
    message: 'Invalid GPS coordinates',
    path: ['latitude'],
  }
);

export type CreateLessonLogInput = z.infer<typeof createLessonLogSchema>;

export const updateLessonLogSchema = z.object({
  id: z.string().uuid(),
  theme: z.string().min(3).max(200).optional(),
  content: z.string().min(10).optional(),
  homework: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(15).max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  wifiSsid: z.string().max(100).nullable().optional(),
  deviceInfo: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => {
    if (data.latitude !== undefined || data.longitude !== undefined) {
      const lat = data.latitude ?? 0;
      const lon = data.longitude ?? 0;
      return isValidCoordinates(lat, lon);
    }
    return true;
  },
  {
    message: 'Invalid GPS coordinates',
    path: ['latitude'],
  }
);

export type UpdateLessonLogInput = z.infer<typeof updateLessonLogSchema>;

export const submitLessonLogSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().nullable().optional(),
});

export type SubmitLessonLogInput = z.infer<typeof submitLessonLogSchema>;

export const validateLessonLogSchema = z.object({
  id: z.string().uuid(),
});

export type ValidateLessonLogInput = z.infer<typeof validateLessonLogSchema>;

export const rejectLessonLogSchema = z.object({
  id: z.string().uuid(),
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
});

export type RejectLessonLogInput = z.infer<typeof rejectLessonLogSchema>;

export const deleteLessonLogSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteLessonLogInput = z.infer<typeof deleteLessonLogSchema>;

// ============================================================================
// LESSON LOG DOCUMENTS
// ============================================================================

export const lessonLogDocumentSchema = z.object({
  id: z.string().uuid(),
  lessonLogId: z.string().uuid(),
  schoolId: z.string().uuid(),
  fileName: z.string(),
  filePath: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  uploadedBy: z.string().uuid(),
  uploadedAt: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

export type LessonLogDocument = z.infer<typeof lessonLogDocumentSchema>;

export const uploadLessonLogDocumentSchema = z.object({
  lessonLogId: z.string().uuid(),
  schoolId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  filePath: z.string().min(1),
  fileSize: z.number().int().positive().max(20971520, 'File size must not exceed 20MB'), // 20MB
  mimeType: z.string().refine(
    (mime) => [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(mime),
    {
      message: 'Invalid file type. Allowed types: PDF, JPEG, PNG, DOC, DOCX, PPT, PPTX',
    }
  ),
  metadata: z.record(z.any()).optional().default({}),
});

export type UploadLessonLogDocumentInput = z.infer<typeof uploadLessonLogDocumentSchema>;

export const deleteLessonLogDocumentSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteLessonLogDocumentInput = z.infer<typeof deleteLessonLogDocumentSchema>;

// ============================================================================
// FILTERS
// ============================================================================

export const lessonLogFiltersSchema = z.object({
  teacherId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: lessonLogStatusSchema.optional(),
});

export type LessonLogFilters = z.infer<typeof lessonLogFiltersSchema>;

// ============================================================================
// RELATIONSHIP SCHEMAS
// ============================================================================

export const lessonLogWithRelationsSchema = lessonLogSchema.extend({
  plannedSession: z.object({
    id: z.string().uuid(),
    startTime: z.string(),
    endTime: z.string(),
    roomName: z.string().nullable(),
  }).optional(),
  teacher: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }).optional(),
  class: z.object({
    id: z.string().uuid(),
    name: z.string(),
    level: z.string(),
  }).optional(),
  subject: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).optional(),
  documents: z.array(lessonLogDocumentSchema).optional(),
});

export type LessonLogWithRelations = z.infer<typeof lessonLogWithRelationsSchema>;

// ============================================================================
// STATS
// ============================================================================

export const teacherLessonStatsSchema = z.object({
  teacherId: z.string().uuid(),
  totalLessons: z.number(),
  validatedLessons: z.number(),
  pendingLessons: z.number(),
  rejectedLessons: z.number(),
  totalMinutes: z.number(),
  validatedMinutes: z.number(),
  pendingMinutes: z.number(),
  totalHours: z.number(),
  validatedHours: z.number(),
  completionRate: z.number(), // Percentage
});

export type TeacherLessonStats = z.infer<typeof teacherLessonStatsSchema>;

export const schoolLessonStatsSchema = z.object({
  schoolId: z.string().uuid(),
  totalLessons: z.number(),
  validatedLessons: z.number(),
  pendingLessons: z.number(),
  totalTeachers: z.number(),
  totalHours: z.number(),
  validatedHours: z.number(),
});

export type SchoolLessonStats = z.infer<typeof schoolLessonStatsSchema>;

// ============================================================================
// VALIDATION LOCATION INPUT
// ============================================================================

export const validateLessonLogLocationInputSchema = z.object({
  lessonLogId: z.string().uuid(),
  latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
  longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  wifiSsid: z.string().max(100).nullable().optional(),
  deviceInfo: z.object({
    deviceId: z.string().optional(),
    platform: z.string().optional(),
    appVersion: z.string().optional(),
  }).optional(),
}).refine(
  (data) => isValidCoordinates(data.latitude, data.longitude),
  {
    message: 'Invalid GPS coordinates',
    path: ['latitude'],
  }
);

export type ValidateLessonLogLocationInput = z.infer<typeof validateLessonLogLocationInputSchema>;

export const validateLessonLogLocationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.enum(['out_of_range', 'wrong_wifi', 'invalid_location', 'not_authorized']).optional(),
  distance: z.number().optional(), // Distance from school in meters
  withinRange: z.boolean().optional(),
  wifiValid: z.boolean().optional(),
});

export type ValidateLessonLogLocationResponse = z.infer<typeof validateLessonLogLocationResponseSchema>;
