import { z } from "zod";

// Support ticket enums
export const ticketPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const ticketStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting_response",
  "resolved",
  "closed",
]);

// Support ticket schemas
export const supportTicketSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  createdBy: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  category: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().nullable(),
  closedAt: z.date().nullable(),
});

export const createTicketSchema = z.object({
  schoolId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: ticketPrioritySchema.default("medium"),
  category: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateTicketSchema = createTicketSchema
  .partial()
  .extend({
    status: ticketStatusSchema.optional(),
    assignedTo: z.string().uuid().nullable().optional(),
  });

export const assignTicketSchema = z.object({
  assignedTo: z.string().uuid(),
});

export const changeTicketStatusSchema = z.object({
  status: ticketStatusSchema,
});

export const closeTicketSchema = z.object({
  resolution: z.string().min(1),
});

// Support ticket message schemas
export const ticketMessageSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  userId: z.string().uuid(),
  message: z.string().min(1),
  attachments: z.array(z.any()).default([]),
  isInternal: z.boolean().default(false),
  createdAt: z.date(),
});

export const createTicketMessageSchema = z.object({
  message: z.string().min(1),
  attachments: z.array(z.any()).optional(),
  isInternal: z.boolean().default(false),
});

// Ticket filters
export const ticketFiltersSchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assignedTo: z.string().uuid().optional(),
  category: z.string().optional(),
  createdBy: z.string().uuid().optional(),
  search: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  assignedToMe: z.boolean().optional(),
  unassigned: z.boolean().optional(),
});

// Ticket statistics
export const ticketStatsSchema = z.object({
  total: z.number().int(),
  open: z.number().int(),
  inProgress: z.number().int(),
  waitingResponse: z.number().int(),
  resolved: z.number().int(),
  closed: z.number().int(),
  byPriority: z.record(z.number().int()),
  byCategory: z.record(z.number().int()),
  avgResolutionTime: z.number().optional(), // In hours
  resolvedToday: z.number().int(),
  unassigned: z.number().int(),
});
