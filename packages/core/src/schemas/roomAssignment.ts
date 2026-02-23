import { z } from 'zod';

export const roomSizeCategorySchema = z.enum(['very_large', 'large', 'medium', 'small']);

export const roomAssignmentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  sessionDate: z.coerce.date(),
  scheduleSlotId: z.string().uuid().nullable(),
  teacherId: z.string().uuid(),
  subjectId: z.string().uuid(),
  campusId: z.string().uuid().nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  groupedClassIds: z.array(z.string().uuid()),
  totalStudents: z.number().int().positive(),
  assignedRoomId: z.string().uuid().nullable(),
  assignmentMethod: z.enum(['auto', 'manual', 'fallback']),
  capacityStatus: z.enum(['sufficient', 'insufficient', 'optimal']).nullable(),
  capacityMarginPercent: z.number().nullable(),
  status: z.enum(['draft', 'published', 'updated', 'cancelled']),
  version: z.number().int().positive(),
  notifiedAt: z.coerce.date().nullable(),
  notificationSent: z.boolean(),
  calculatedBy: z.string().uuid().nullable(),
  calculatedAt: z.coerce.date(),
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createRoomAssignmentSchema = roomAssignmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  status: true,
  version: true,
  notificationSent: true,
  calculatedAt: true,
});

export const roomAssignmentEventSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  roomAssignmentId: z.string().uuid(),
  eventType: z.enum(['created', 'updated', 'published', 'notified', 'cancelled']),
  oldRoomId: z.string().uuid().nullable(),
  newRoomId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  triggeredBy: z.string().uuid().nullable(),
  metadata: z.record(z.any()),
  createdAt: z.coerce.date(),
});

export type RoomSizeCategory = z.infer<typeof roomSizeCategorySchema>;
export type RoomAssignment = z.infer<typeof roomAssignmentSchema>;
export type CreateRoomAssignment = z.infer<typeof createRoomAssignmentSchema>;
export type RoomAssignmentEvent = z.infer<typeof roomAssignmentEventSchema>;
