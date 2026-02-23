import { z } from "zod";

// ============================================
// ENUMS
// ============================================

export const genderSchema = z.enum([
  "male",
  "female",
  "other",
  "prefer_not_to_say",
]);

export const studentStatusSchema = z.enum([
  "active",
  "inactive",
  "graduated",
  "transferred",
  "expelled",
  "suspended",
]);

export const enrollmentStatusSchema = z.enum([
  "enrolled",
  "pending",
  "withdrawn",
  "completed",
]);

export const studentDocumentTypeSchema = z.enum([
  "birth_certificate",
  "id_card",
  "passport",
  "medical_certificate",
  "transcript",
  "diploma",
  "photo",
  "other",
]);

// ============================================
// STUDENTS
// ============================================

export const studentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  matricule: z.string().min(1, "Matricule is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.coerce.date(),
  gender: genderSchema.optional(),
  placeOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
  status: studentStatusSchema.default("active"),
  medicalInfo: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createStudentSchema = z.object({
  schoolId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  matricule: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.coerce.date(),
  gender: genderSchema.optional(),
  placeOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
  status: studentStatusSchema.default("active"),
  medicalInfo: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateStudentSchema = studentSchema
  .partial()
  .required({ id: true });

// ============================================
// PARENTS
// ============================================

export const parentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  relationship: z.string().optional(),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  workplace: z.string().optional(),
  isPrimaryContact: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createParentSchema = z.object({
  schoolId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email"),
  address: z.string().optional(),
  city: z.string().optional(),
  occupation: z.string().optional(),
  workplace: z.string().optional(),
  isPrimaryContact: z.boolean().default(false),
  isEmergencyContact: z.boolean().default(false),
  password: z.string().min(6, "Password must be at least 6 characters"),
  metadata: z.record(z.unknown()).optional(),
});

export const updateParentSchema = parentSchema.partial().required({ id: true });

// ============================================
// STUDENT-PARENT RELATIONS
// ============================================

export const studentParentRelationSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  parentId: z.string().uuid(),
  relationship: z.string().optional(),
  isPrimary: z.boolean().default(false),
  canPickup: z.boolean().default(true),
  canViewGrades: z.boolean().default(true),
  canViewAttendance: z.boolean().default(true),
  createdAt: z.coerce.date(),
});

export const createStudentParentRelationSchema = z.object({
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  parentId: z.string().uuid(),
  relationship: z.string().optional(),
  isPrimary: z.boolean().default(false),
  canPickup: z.boolean().default(true),
  canViewGrades: z.boolean().default(true),
  canViewAttendance: z.boolean().default(true),
});

export const updateStudentParentRelationSchema = studentParentRelationSchema
  .partial()
  .required({ id: true });

// ============================================
// ENROLLMENTS
// ============================================

export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  enrollmentDate: z.coerce.date(),
  status: enrollmentStatusSchema.default("enrolled"),
  withdrawalDate: z.coerce.date().nullable(),
  withdrawalReason: z.string().optional(),
  isRepeating: z.boolean().default(false),
  previousClassId: z.string().uuid().nullable(),
  notes: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createEnrollmentSchema = z.object({
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  enrollmentDate: z.coerce.date().default(() => new Date()),
  status: enrollmentStatusSchema.default("enrolled"),
  withdrawalDate: z.coerce.date().nullable().optional(),
  withdrawalReason: z.string().optional(),
  isRepeating: z.boolean().default(false),
  previousClassId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  annualTuitionAmount: z.number().nonnegative().optional(),
  scholarshipType: z.enum(["none", "partial", "full"]).default("none"),
  scholarshipReason: z.string().optional(),
  tuitionYear: z.string().optional(),
});

export const updateEnrollmentSchema = enrollmentSchema
  .partial()
  .required({ id: true });

// ============================================
// STUDENT DOCUMENTS
// ============================================

export const studentDocumentSchema = z.object({
  id: z.string().uuid(),
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  documentType: studentDocumentTypeSchema,
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  fileUrl: z.union([z.string().url(), z.literal('')]),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  uploadedBy: z.string().uuid().nullable(),
  uploadedAt: z.coerce.date(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
});

export const createStudentDocumentSchema = z.object({
  schoolId: z.string().uuid(),
  studentId: z.string().uuid(),
  documentType: studentDocumentTypeSchema,
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  fileUrl: z.union([z.string().url(), z.literal('')]),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  uploadedBy: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateStudentDocumentSchema = studentDocumentSchema
  .partial()
  .required({ id: true });

// ============================================
// BULK OPERATIONS
// ============================================

export const bulkEnrollStudentsSchema = z.object({
  schoolId: z.string().uuid(),
  classId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  studentIds: z
    .array(z.string().uuid())
    .min(1, "At least one student is required"),
  enrollmentDate: z.coerce.date().default(() => new Date()),
});

// ============================================
// EXPORTS
// ============================================

export type Gender = z.infer<typeof genderSchema>;
export type StudentStatus = z.infer<typeof studentStatusSchema>;
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;
export type StudentDocumentType = z.infer<typeof studentDocumentTypeSchema>;

export type Student = z.infer<typeof studentSchema>;
export type CreateStudent = z.infer<typeof createStudentSchema>;
export type UpdateStudent = z.infer<typeof updateStudentSchema>;

export type Parent = z.infer<typeof parentSchema>;
export type CreateParent = z.infer<typeof createParentSchema>;
export type UpdateParent = z.infer<typeof updateParentSchema>;

export type StudentParentRelation = z.infer<typeof studentParentRelationSchema>;
export type CreateStudentParentRelation = z.infer<
  typeof createStudentParentRelationSchema
>;
export type UpdateStudentParentRelation = z.infer<
  typeof updateStudentParentRelationSchema
>;

export type Enrollment = z.infer<typeof enrollmentSchema>;
export type CreateEnrollment = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollment = z.infer<typeof updateEnrollmentSchema>;

export type StudentDocument = z.infer<typeof studentDocumentSchema>;
export type CreateStudentDocument = z.infer<typeof createStudentDocumentSchema>;
export type UpdateStudentDocument = z.infer<typeof updateStudentDocumentSchema>;

export type BulkEnrollStudents = z.infer<typeof bulkEnrollStudentsSchema>;
