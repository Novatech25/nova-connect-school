import { z } from "zod";

// User schemas
export const userRoleSchema = z.enum([
  "super_admin",
  "school_admin",
  "accountant",
  "teacher",
  "student",
  "parent",
  "supervisor",
]);

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  schoolId: z.string().uuid().nullable(),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createUserSchema = userSchema.partial({
  id: true,
  avatarUrl: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = createUserSchema.partial();

// RBAC schemas
export const roleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  isSystem: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createRoleSchema = roleSchema.partial({
  id: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
});

export const permissionSchema = z.object({
  id: z.string().uuid(),
  resource: z.string().min(1),
  action: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const auditActionSchema = z.enum([
  "INSERT",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "VALIDATE",
]);

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  action: auditActionSchema,
  resourceType: z.string().min(1),
  resourceId: z.string().uuid().optional(),
  oldData: z.record(z.unknown()).optional(),
  newData: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});

export const userRoleAssignmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  schoolId: z.string().uuid().nullable(),
  assignedBy: z.string().uuid().nullable(),
  assignedAt: z.date(),
});

// School schemas
export const schoolStatusSchema = z.enum(["active", "suspended", "archived"]);
export const subscriptionPlanSchema = z.enum(["free", "basic", "premium", "enterprise"]);
export const enabledModuleSchema = z.enum([
  "qr_attendance",
  "mobile_money",
  "exam_mode",
  "multi_campus",
  "api_export",
  "elearning",
  "chat",
]);

export const schoolSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  status: schoolStatusSchema,
  logoUrl: z.string().url().optional(),
  subscriptionPlan: subscriptionPlanSchema.optional(),
  subscriptionExpiresAt: z.date().optional(),
  maxStudents: z.number().int().positive().optional(),
  maxTeachers: z.number().int().positive().optional(),
  maxClasses: z.number().int().positive().optional(),
  enabledModules: z.array(enabledModuleSchema).default([]),
  settings: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createSchoolSchema = schoolSchema.partial({
  id: true,
  logoUrl: true,
  subscriptionPlan: true,
  subscriptionExpiresAt: true,
  maxStudents: true,
  maxTeachers: true,
  maxClasses: true,
  enabledModules: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSchoolSchema = createSchoolSchema.partial();

// Authentication schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  ),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: userRoleSchema,
  schoolCode: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Class schemas
export const classSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  name: z.string().min(1),
  grade: z.string().min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  homeroomTeacherId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createClassSchema = classSchema.partial({
  id: true,
  homeroomTeacherId: true,
  createdAt: true,
  updatedAt: true,
});

// Subject schemas
export const subjectSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  levelId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  grade: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  isActive: z.boolean().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createSubjectSchema = subjectSchema.partial({
  id: true,
  icon: true,
  color: true,
  createdAt: true,
  updatedAt: true,
});

// Attendance schemas
export const attendanceStatusSchema = z.enum(["present", "absent", "late", "excused"]);

export const attendanceRecordSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.date(),
  status: attendanceStatusSchema,
  notes: z.string().optional(),
  recordedBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createAttendanceRecordSchema = attendanceRecordSchema.partial({
  id: true,
  recordedBy: true,
  createdAt: true,
  updatedAt: true,
});

export const bulkAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.date(),
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: attendanceStatusSchema,
    notes: z.string().optional(),
  })),
});

// Grade schemas
export const gradeTypeSchema = z.enum(["assignment", "exam", "quiz", "project", "participation"]);

export const gradeSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  type: gradeTypeSchema,
  title: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().positive(),
  percentage: z.number().min(0).max(100),
  gradedBy: z.string().uuid(),
  date: z.date(),
  comments: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createGradeSchema = gradeSchema.partial({
  id: true,
  percentage: true,
  gradedBy: true,
  createdAt: true,
  updatedAt: true,
});

// Schedule schemas
export const scheduleSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().optional(),
  semester: z.string(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createScheduleSchema = scheduleSchema.partial({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Announcement schemas
export const announcementPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const announcementSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  priority: announcementPrioritySchema,
  authorId: z.string().uuid(),
  targetAudience: z.array(userRoleSchema),
  publishedAt: z.date(),
  expiresAt: z.date().optional(),
  attachments: z.array(z.string().url()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createAnnouncementSchema = announcementSchema.partial({
  id: true,
  authorId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

// License schemas
export * from "./license";

// Support ticket schemas
export * from "./supportTicket";

// School configuration schemas
export * from "./schoolConfig";

// School settings schemas
export * from "./schoolSettings";

// Student schemas
export * from "./students";

// Schedule schemas
export * from "./schedule";

// Notification schemas
export * from "./notification";

// Attendance schemas
export * from "./attendance";

// QR Attendance schemas
export {
  QrCodeTypeSchema,
  QrScanStatusSchema,
  generateQrCodeSchemaRefined,
  generateQrCodeSchemaRefined2,
  generateQrCodeSchema,
  validateQrScanSchema,
  qrAttendanceCodeSchema,
  qrScanLogSchema,
  generateQrCodeResponseSchema,
  validateQrScanSuccessResponseSchema,
  validateQrScanErrorResponseSchema,
  validateQrScanResponseSchema,
  qrScanLogsFilterSchema,
} from "./qrAttendance";

export type {
  QrCodeType,
  QrScanStatus,
  GenerateQrCodeInput,
  ValidateQrScanInput,
  QrAttendanceCode,
  QrScanLog,
  GenerateQrCodeResponse,
  ValidateQrScanResponse,
  QrScanLogsFilter,
} from "./qrAttendance";

// Grades management schemas
export * from "./grades";

// Report cards schemas
export * from "./reportCards";

// Payment schemas
export * from "./payments";

// Document access schemas
export * from "./documentAccess";

// Student cards schemas
export * from "./studentCards";

// Payroll schemas
export * from "./payroll";

// Mobile Money schemas
export * from "./mobileMoney";

// Exam schemas
export * from "./exams";

// Multi-campus schemas
export * from "./multiCampus";

// Room assignment schemas
export * from "./roomAssignment";

// Chat schemas
export * from "./chat";

// Import schemas
export * from "./imports";

// Promotion schemas
export * from "./promotions";

// Grading systems schemas
export * from "./gradingSystems";

// User account management schemas
export * from "./users";

// Budget schemas
export * from "./budget";

// eLearning schemas
export * from "./elearning";
