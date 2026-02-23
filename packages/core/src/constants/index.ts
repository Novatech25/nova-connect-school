// User roles
export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  SCHOOL_ADMIN: "school_admin",
  ACCOUNTANT: "accountant",
  TEACHER: "teacher",
  STUDENT: "student",
  PARENT: "parent",
  SUPERVISOR: "supervisor",
} as const;

// Permissions
export const PERMISSIONS = {
  // Schools
  SCHOOLS_CREATE: "schools:create",
  SCHOOLS_READ: "schools:read",
  SCHOOLS_UPDATE: "schools:update",
  SCHOOLS_DELETE: "schools:delete",

  // Users
  USERS_CREATE: "users:create",
  USERS_READ: "users:read",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",

  // Students
  STUDENTS_CREATE: "students:create",
  STUDENTS_READ: "students:read",
  STUDENTS_UPDATE: "students:update",
  STUDENTS_DELETE: "students:delete",

  // Grades
  GRADES_CREATE: "grades:create",
  GRADES_READ: "grades:read",
  GRADES_UPDATE: "grades:update",
  GRADES_DELETE: "grades:delete",
  GRADES_VALIDATE: "grades:validate",

  // Attendance
  ATTENDANCE_CREATE: "attendance:create",
  ATTENDANCE_READ: "attendance:read",
  ATTENDANCE_UPDATE: "attendance:update",
  ATTENDANCE_DELETE: "attendance:delete",
  ATTENDANCE_VALIDATE: "attendance:validate",

  // Payments
  PAYMENTS_CREATE: "payments:create",
  PAYMENTS_READ: "payments:read",
  PAYMENTS_UPDATE: "payments:update",
  PAYMENTS_DELETE: "payments:delete",

  // Schedules
  SCHEDULES_CREATE: "schedules:create",
  SCHEDULES_READ: "schedules:read",
  SCHEDULES_UPDATE: "schedules:update",
  SCHEDULES_DELETE: "schedules:delete",
  SCHEDULES_PUBLISH: "schedules:publish",

  // Reports
  REPORTS_READ: "reports:read",
  REPORTS_EXPORT: "reports:export",

  // Audit Logs
  AUDIT_LOGS_READ: "audit_logs:read",

  // Classes
  CLASSES_CREATE: "classes:create",
  CLASSES_READ: "classes:read",
  CLASSES_UPDATE: "classes:update",
  CLASSES_DELETE: "classes:delete",

  // Subjects
  SUBJECTS_CREATE: "subjects:create",
  SUBJECTS_READ: "subjects:read",
  SUBJECTS_UPDATE: "subjects:update",
  SUBJECTS_DELETE: "subjects:delete",

  // Roles
  ROLES_CREATE: "roles:create",
  ROLES_READ: "roles:read",
  ROLES_UPDATE: "roles:update",
  ROLES_DELETE: "roles:delete",
  PERMISSIONS_ASSIGN: "permissions:assign",
} as const;

// Audit actions
export const AUDIT_ACTIONS = {
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  EXPORT: "EXPORT",
  VALIDATE: "VALIDATE",
} as const;

// Subscription plans
export const SUBSCRIPTION_PLANS = {
  FREE: "free",
  BASIC: "basic",
  PREMIUM: "premium",
  ENTERPRISE: "enterprise",
} as const;

// Enabled modules
export const ENABLED_MODULES = {
  QR_ATTENDANCE: "qr_attendance",
  MOBILE_MONEY: "mobile_money",
  EXAM_MODE: "exam_mode",
  MULTI_CAMPUS: "multi_campus",
  API_EXPORT: "api_export",
  ELEARNING: "elearning",
  CHAT: "chat",
} as const;

// School statuses
export const SCHOOL_STATUSES = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  ARCHIVED: "archived",
} as const;

// Attendance statuses
export const ATTENDANCE_STATUSES = {
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
  EXCUSED: "excused",
} as const;

// Grade types
export const GRADE_TYPES = {
  ASSIGNMENT: "assignment",
  EXAM: "exam",
  QUIZ: "quiz",
  PROJECT: "project",
  PARTICIPATION: "participation",
} as const;

// Announcement priorities
export const ANNOUNCEMENT_PRIORITIES = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
} as const;

// Notification types
export const NOTIFICATION_TYPES = {
  ANNOUNCEMENT: "announcement",
  GRADE_POSTED: "grade_posted",
  ATTENDANCE_MARKED: "attendance_marked",
  SCHEDULE_CHANGE: "schedule_change",
  MESSAGE: "message",
} as const;

// Date formats
export const DATE_FORMATS = {
  SHORT: "P",
  MEDIUM: "PPP",
  LONG: "PPPP",
  SHORT_WITH_TIME: "P p",
  MEDIUM_WITH_TIME: "PPP p",
  TIME_ONLY: "p",
  ISO: "yyyy-MM-dd",
  DISPLAY: "MMM d, yyyy",
  DISPLAY_WITH_TIME: "MMM d, yyyy 'at' h:mm a",
} as const;

// Days of week
export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Cache durations (in seconds)
export const CACHE_DURATIONS = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  VERY_LONG: 3600, // 1 hour
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  AVATAR: 5 * 1024 * 1024, // 5MB
  ATTACHMENT: 25 * 1024 * 1024, // 25MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  IMAGE: 5 * 1024 * 1024, // 5MB
} as const;

// Allowed file types
export const FILE_TYPES = {
  IMAGES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  DOCUMENTS: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ATTACHMENTS: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

// Academic year patterns
export const ACADEMIC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

// Regular expressions
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-()]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  SCHOOL_CODE: /^[A-Z0-9]{3,20}$/,
  ACADEMIC_YEAR: /^\d{4}-\d{4}$/,
  TIME: /^\d{2}:\d{2}$/,
  COLOR: /^#[0-9A-F]{6}$/i,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "You don't have permission to perform this action",
  NOT_FOUND: "The requested resource was not found",
  VALIDATION_ERROR: "Please check your input and try again",
  NETWORK_ERROR: "Network error. Please check your connection",
  SERVER_ERROR: "Something went wrong. Please try again later",
  INVALID_CREDENTIALS: "Invalid email or password",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists",
  WEAK_PASSWORD: "Password must be at least 8 characters with uppercase, lowercase, and number",
  INVALID_TOKEN: "Invalid or expired token",
} as const;

// Academic semesters
export const SEMESTERS = ["Fall", "Spring", "Summer"] as const;

// Grade ranges for letter grades
export const GRADE_RANGES = [
  { min: 97, max: 100, letter: "A+", gpa: 4.0 },
  { min: 93, max: 96.99, letter: "A", gpa: 4.0 },
  { min: 90, max: 92.99, letter: "A-", gpa: 3.7 },
  { min: 87, max: 89.99, letter: "B+", gpa: 3.3 },
  { min: 83, max: 86.99, letter: "B", gpa: 3.0 },
  { min: 80, max: 82.99, letter: "B-", gpa: 2.7 },
  { min: 77, max: 79.99, letter: "C+", gpa: 2.3 },
  { min: 73, max: 76.99, letter: "C", gpa: 2.0 },
  { min: 70, max: 72.99, letter: "C-", gpa: 1.7 },
  { min: 67, max: 69.99, letter: "D+", gpa: 1.3 },
  { min: 63, max: 66.99, letter: "D", gpa: 1.0 },
  { min: 60, max: 62.99, letter: "D-", gpa: 0.7 },
  { min: 0, max: 59.99, letter: "F", gpa: 0.0 },
] as const;
