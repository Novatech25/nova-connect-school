import { z } from "zod";

export const chatConversationTypeSchema = z.enum(['one_to_one', 'class_group']);
export const chatMessageStatusSchema = z.enum(['pending', 'sent', 'delivered', 'read', 'deleted', 'moderated']);
export const chatModerationActionSchema = z.enum(['flagged', 'approved', 'rejected', 'user_blocked', 'user_unblocked']);
export const chatAttachmentTypeSchema = z.enum(['image', 'document', 'pdf', 'video', 'audio']);

// Conversation
export const createConversationSchema = z.object({
  schoolId: z.string().uuid(),
  conversationType: chatConversationTypeSchema,
  classId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  participantIds: z.array(z.string().uuid()).min(2),
  metadata: z.record(z.unknown()).optional(),
});

export const conversationSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  conversationType: chatConversationTypeSchema,
  classId: z.string().uuid().optional(),
  title: z.string(),
  isActive: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  metadata: z.record(z.unknown()).optional(),
});

// Message
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  parentMessageId: z.string().uuid().optional(),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  content: z.string(),
  status: chatMessageStatusSchema,
  isModerated: z.boolean(),
  moderationRequired: z.boolean(),
  parentMessageId: z.string().uuid().optional(),
  sentAt: z.coerce.date(),
  editedAt: z.coerce.date().optional(),
  deletedAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Attachment
export const uploadAttachmentSchema = z.object({
  messageId: z.string().uuid(),
  file: z.instanceof(File),
});

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  fileName: z.string(),
  fileType: chatAttachmentTypeSchema,
  fileSize: z.number(),
  filePath: z.string(),
  fileUrl: z.string().optional(),
  mimeType: z.string(),
  uploadedAt: z.coerce.date(),
  uploadedBy: z.string().uuid(),
});

// Moderation
export const moderateMessageSchema = z.object({
  messageId: z.string().uuid(),
  action: chatModerationActionSchema,
  reason: z.string().min(1).max(500),
});

export const blockUserSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export const moderationRuleSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  ruleType: z.enum(['forbidden_word', 'regex_pattern', 'max_message_length']),
  ruleValue: z.string(),
  action: z.enum(['flag', 'block', 'require_approval']),
  isActive: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createModerationRuleSchema = z.object({
  schoolId: z.string().uuid(),
  ruleType: z.enum(['forbidden_word', 'regex_pattern', 'max_message_length']),
  ruleValue: z.string().min(1),
  action: z.enum(['flag', 'block', 'require_approval']),
});

// Types TypeScript exportés
export type ChatConversationType = z.infer<typeof chatConversationTypeSchema>;
export type ChatMessageStatus = z.infer<typeof chatMessageStatusSchema>;
export type ChatModerationAction = z.infer<typeof chatModerationActionSchema>;
export type ChatAttachmentType = z.infer<typeof chatAttachmentTypeSchema>;
export type CreateConversation = z.infer<typeof createConversationSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type SendMessage = z.infer<typeof sendMessageSchema>;
export type Message = z.infer<typeof messageSchema>;
export type UploadAttachment = z.infer<typeof uploadAttachmentSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type ModerateMessage = z.infer<typeof moderateMessageSchema>;
export type BlockUser = z.infer<typeof blockUserSchema>;
export type ModerationRule = z.infer<typeof moderationRuleSchema>;
export type CreateModerationRule = z.infer<typeof createModerationRuleSchema>;
