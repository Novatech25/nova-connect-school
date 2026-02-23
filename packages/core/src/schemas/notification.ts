import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "schedule_published",
  "schedule_updated",
  "grade_posted",
  "grade_published",
  "report_card_published",
  "attendance_marked",
  "payment_due",
  "payment_overdue",
  "lesson_validated",
  "payroll_processed",
  "document_blocked",
  "announcement",
  "assignment_published",
  "assignment_deadline_soon",
  "assignment_submitted",
  "assignment_graded",
  "resource_published",
]);

export const notificationPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const notificationChannelSchema = z.enum(["in_app", "push", "email", "sms", "whatsapp"]);
export const notificationStatusSchema = z.enum(["pending", "sent", "failed"]);

export const createNotificationSchema = z.object({
  schoolId: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  data: z.record(z.unknown()).optional(),
  priority: notificationPrioritySchema.default("normal"),
  channels: z.array(notificationChannelSchema).default(["in_app"]),
});

export const updateNotificationPreferenceSchema = z.object({
  notificationType: notificationTypeSchema,
  enabledChannels: z.array(notificationChannelSchema).min(1),
});

export const notificationPreferenceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  notificationType: notificationTypeSchema,
  enabledChannels: z.array(notificationChannelSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const notificationSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  userId: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).optional(),
  priority: notificationPrioritySchema,
  channels: z.array(notificationChannelSchema),
  readAt: z.coerce.date().optional(),
  sentAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export const notificationLogSchema = z.object({
  id: z.string().uuid(),
  notificationId: z.string().uuid(),
  channel: notificationChannelSchema,
  status: notificationStatusSchema,
  errorMessage: z.string().optional(),
  sentAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
});
