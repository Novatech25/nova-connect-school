// User types
export type UserRole =
  | "super_admin"
  | "school_admin"
  | "accountant"
  | "teacher"
  | "student"
  | "parent"
  | "supervisor";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolId: string | null; // NULL for super_admin
  avatarUrl?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// RBAC Types
export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  roleId_role: Role;
  schoolId: string | null;
  schoolId_school?: School;
  assignedBy: string | null;
  assignedAt: Date;
}

export interface AuditLog {
  id: string;
  schoolId: string | null;
  userId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "VALIDATE";

// School types
export type SchoolStatus = "active" | "suspended" | "archived";
export type SubscriptionPlan = "free" | "basic" | "premium" | "enterprise";

export interface School {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  status: SchoolStatus;
  logoUrl?: string;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionExpiresAt?: Date;
  maxStudents?: number;
  maxTeachers?: number;
  maxClasses?: number;
  enabledModules: EnabledModule[];
  settings?: SchoolSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type EnabledModule =
  | "qr_attendance"
  | "mobile_money"
  | "exam_mode"
  | "multi_campus"
  | "api_export"
  | "elearning"
  | "chat";

export interface SchoolSettings {
  academicYear?: string;
  currency?: string;
  timezone?: string;
  language?: string;
  [key: string]: unknown;
}

// Class types
export interface Class {
  id: string;
  schoolId: string;
  name: string;
  grade: string;
  academicYear: string;
  homeroomTeacherId?: string;
  students: Student[];
  subjects: Subject[];
  createdAt: Date;
  updatedAt: Date;
}

// Student types
export interface Student {
  id: string;
  userId: string;
  classId: string;
  studentId: string;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other";
  address?: string;
  parentIds: string[];
  enrollmentDate: Date;
  status: "enrolled" | "graduated" | "withdrawn";
  createdAt: Date;
  updatedAt: Date;
}

// Teacher types
export interface Teacher {
  id: string;
  userId: string;
  schoolId: string;
  employeeId: string;
  subjects: string[];
  classes: string[];
  department?: string;
  hireDate: Date;
  status: "active" | "inactive" | "terminated";
  createdAt: Date;
  updatedAt: Date;
}

// Subject types
export interface Subject {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  description?: string;
  grade?: string;
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Attendance types
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: Date;
  status: AttendanceStatus;
  notes?: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Grade types
export type GradeType = "assignment" | "exam" | "quiz" | "project" | "participation";

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  type: GradeType;
  title: string;
  score: number;
  maxScore: number;
  percentage: number;
  gradedBy: string;
  date: Date;
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Schedule types
export interface Schedule {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  room?: string;
  semester: string;
  academicYear: string;
  createdAt: Date;
  updatedAt: Date;
}

// Announcement types
export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";

export interface Announcement {
  id: string;
  schoolId?: string;
  classId?: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  authorId: string;
  targetAudience: UserRole[];
  publishedAt: Date;
  expiresAt?: Date;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Notification types
export type NotificationType =
  | "schedule_published"
  | "schedule_updated"
  | "grade_posted"
  | "attendance_marked"
  | "payment_due"
  | "payment_overdue"
  | "lesson_validated"
  | "payroll_processed"
  | "document_blocked"
  | "announcement";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "in_app" | "push" | "email" | "sms" | "whatsapp";
export type NotificationStatus = "pending" | "sent" | "failed";

export interface Notification {
  id: string;
  schoolId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  readAt?: Date;
  sentAt: Date;
  createdAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationType;
  enabledChannels: NotificationChannel[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLog {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  errorMessage?: string;
  sentAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateNotification {
  schoolId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
}

// API Response types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// ============================================
// Export Module Types
// ============================================

export type ExportType = 'excel' | 'pdf' | 'csv';

export type ExportResourceType =
  | 'bulletins'
  | 'students'
  | 'attendance'
  | 'payments'
  | 'payroll'
  | 'grades'
  | 'schedules'
  | 'lesson_logs'
  | 'student_cards'
  | 'exam_results';

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

export interface ExportColumn {
  key: string;
  header?: string;
  width?: number;
  format?: {
    type?: 'number' | 'currency' | 'percentage' | 'date' | 'integer' | 'string';
    decimals?: number;
    symbol?: string;
  };
  visible?: boolean;
}

export interface ExportTemplateConfig {
  columns?: ExportColumn[];
  filters?: Record<string, unknown>;
  styles?: {
    headerColor?: string;
    headerFont?: string;
    headerFontSize?: number;
    headerBold?: boolean;
    alternateRows?: boolean;
    alternateRowColor?: string;
    logo?: boolean;
    pageSize?: 'A4' | 'A3' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    schoolHeader?: boolean;
    footer?: boolean;
    signatureLines?: boolean;
    separator?: ',' | ';' | '\t';
    encoding?: string;
    includeBOM?: boolean;
  };
  sortBy?: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

export interface ExportTemplate {
  id: string;
  school_id: string;
  name: string;
  description?: string;
  export_type: ExportType;
  resource_type: ExportResourceType;
  template_config: ExportTemplateConfig;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExportJob {
  id: string;
  school_id: string;
  template_id: string | null;
  export_type: ExportType;
  resource_type: ExportResourceType;
  status: ExportStatus;
  file_path: string | null;
  file_size_bytes: number | null;
  filters: Record<string, unknown>;
  row_count: number | null;
  initiated_by: string;
  scheduled_job_id: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ScheduledExport {
  id: string;
  school_id: string;
  template_id: string | null;
  name: string;
  cron_expression: string;
  filters: Record<string, unknown>;
  recipients: string[];
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExportApiToken {
  id: string;
  school_id: string;
  token_hash: string;
  name: string;
  description?: string;
  permissions: ExportResourceType[];
  expires_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  rate_limit_per_hour: number;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

export interface ExportFilters {
  dateRange?: {
    start?: string;
    end?: string;
  };
  periodId?: string;
  classId?: string;
  status?: string;
  studentIds?: string[];
  teacherId?: string;
  subjectId?: string;
  gradeType?: string;
  feeType?: string;
  paymentMethod?: string;
}

export interface LaunchExportRequest {
  templateId?: string;
  templateConfig?: ExportTemplateConfig;
  exportType: ExportType;
  resourceType: ExportResourceType;
  filters?: ExportFilters;
}

export interface LaunchExportResponse {
  success: boolean;
  jobId: string;
  status: ExportStatus;
  exportType?: ExportType;
  resourceType?: ExportResourceType;
}

export interface DownloadExportResponse {
  success: boolean;
  signedUrl: string;
  fileName: string;
  fileSize: number;
  rowCount?: number;
  expiresAt: string;
}

export interface ExportStatistics {
  totalExports: number;
  exportsThisMonth: number;
  exportsByType: Record<ExportType, number>;
  exportsByResource: Record<ExportResourceType, number>;
  successRate: number;
  averageFileSize: number;
  averageProcessingTime: number;
}
