// Re-export all modules
// Note: Some types are exported from both ./types and ./schemas
// TypeScript will merge these exports, but explicit resolution is used where needed

export * from "./types";
export * from "./schemas";
export * from "./utils";
export * from "./constants";

// Explicit re-exports to resolve ambiguities between ./types and ./schemas
// These types are primarily defined in ./types and extended in ./schemas
export type {
  AttendanceRecord,
  AttendanceStatus,
  Grade,
  GradeType,
  Schedule,
  SchoolSettings,
  Student,
} from "./types";

// These types are defined in schemas
export type {
  DocumentType,
  PaymentStatus,
  PaymentSummary,
  StudentBalance,
} from "./schemas";
