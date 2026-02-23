import { z } from 'zod';

// ============================================
// ENUM Schemas
// ============================================

export const assignmentStatusSchema = z.enum(['draft', 'published', 'closed', 'archived']);
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;

export const submissionStatusSchema = z.enum(['pending', 'submitted', 'graded', 'returned']);
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

export const resourceTypeSchema = z.enum(['document', 'video', 'link', 'other']);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

// ============================================
// Assignment Schemas
// ============================================

export const createAssignmentSchema = z.object({
  schoolId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères'),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères'),
  instructions: z.string().optional(),
  dueDate: z.string()
    .datetime()
    .refine((date) => new Date(date) > new Date(), {
      message: 'La date limite doit être dans le futur',
    }),
  maxScore: z.number().positive('La note maximale doit être positive').default(20),
  allowLateSubmission: z.boolean().default(false),
  metadata: z.record(z.any()).optional().default({}),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  instructions: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  maxScore: z.number().positive().optional(),
  allowLateSubmission: z.boolean().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const publishAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
});

export type PublishAssignmentInput = z.infer<typeof publishAssignmentSchema>;

export const closeAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
});

export type CloseAssignmentInput = z.infer<typeof closeAssignmentSchema>;

// ============================================
// Assignment File Schemas
// ============================================

export const uploadAssignmentFileSchema = z.object({
  assignmentId: z.string().uuid(),
  schoolId: z.string().uuid(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().positive().max(52428800, 'Le fichier ne doit pas dépasser 50MB'),
  mimeType: z.string().min(1),
  uploadedBy: z.string().uuid(),
  metadata: z.record(z.any()).optional().default({}),
});

export type UploadAssignmentFileInput = z.infer<typeof uploadAssignmentFileSchema>;

// ============================================
// Submission Schemas
// ============================================

export const createSubmissionSchema = z.object({
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  schoolId: z.string().uuid(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const submitAssignmentSchema = z.object({
  submissionId: z.string().uuid(),
});

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;

export const elearningGradeSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  score: z.number().min(0).max(20),
  teacherComment: z.string().optional(),
});

export type GradeSubmissionInput = z.infer<typeof elearningGradeSubmissionSchema>;

export const returnSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
});

export type ReturnSubmissionInput = z.infer<typeof returnSubmissionSchema>;

// ============================================
// Submission File Schemas
// ============================================

export const uploadSubmissionFileSchema = z.object({
  submissionId: z.string().uuid(),
  schoolId: z.string().uuid(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().positive().max(52428800, 'Le fichier ne doit pas dépasser 50MB'),
  mimeType: z.string().min(1),
  metadata: z.record(z.any()).optional().default({}),
});

export type UploadSubmissionFileInput = z.infer<typeof uploadSubmissionFileSchema>;

// ============================================
// Correction File Schemas
// ============================================

export const uploadCorrectionFileSchema = z.object({
  submissionId: z.string().uuid(),
  schoolId: z.string().uuid(),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().positive().max(52428800, 'Le fichier ne doit pas dépasser 50MB'),
  mimeType: z.string().min(1),
  uploadedBy: z.string().uuid(),
  metadata: z.record(z.any()).optional().default({}),
});

export type UploadCorrectionFileInput = z.infer<typeof uploadCorrectionFileSchema>;

// ============================================
// Course Resource Schemas
// ============================================

export const createCourseResourceSchema = z.object({
  schoolId: z.string().uuid(),
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères'),
  description: z.string().optional(),
  resourceType: resourceTypeSchema.default('document'),
  fileName: z.string().optional(),
  filePath: z.string().optional(),
  fileSize: z.number().positive().max(104857600, 'Le fichier ne doit pas dépasser 100MB').optional(),
  mimeType: z.string().optional(),
  externalUrl: z.string().url('URL invalide').optional(),
  metadata: z.record(z.any()).optional().default({}),
}).refine(
  (data) => {
    // Either file data or external URL must be provided based on resource type
    if (data.resourceType === 'document') {
      return !!data.filePath && !!data.fileName && !!data.mimeType;
    }
    if (data.resourceType === 'video' || data.resourceType === 'link') {
      return !!data.externalUrl;
    }
    return true;
  },
  {
    message: 'Fichiers ou URL requis selon le type de ressource',
  }
);

export type CreateCourseResourceInput = z.infer<typeof createCourseResourceSchema>;

export const updateCourseResourceSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  resourceType: resourceTypeSchema.optional(),
  externalUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export type UpdateCourseResourceInput = z.infer<typeof updateCourseResourceSchema>;

export const publishCourseResourceSchema = z.object({
  resourceId: z.string().uuid(),
});

export type PublishCourseResourceInput = z.infer<typeof publishCourseResourceSchema>;

// ============================================
// TypeScript Types (from database)
// ============================================

export interface Assignment {
  id: string;
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  instructions: string | null;
  status: AssignmentStatus;
  dueDate: string;
  maxScore: number;
  allowLateSubmission: boolean;
  publishedAt: string | null;
  closedAt: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentFile {
  id: string;
  assignmentId: string;
  schoolId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  metadata: Record<string, any>;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  schoolId: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  returnedAt: string | null;
  score: number | null;
  teacherComment: string | null;
  isLate: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionFile {
  id: string;
  submissionId: string;
  schoolId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  metadata: Record<string, any>;
}

export interface CorrectionFile {
  id: string;
  submissionId: string;
  schoolId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  metadata: Record<string, any>;
}

export interface CourseResource {
  id: string;
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string | null;
  resourceType: ResourceType;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  externalUrl: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// With Relations Types
// ============================================

export interface AssignmentWithRelations extends Assignment {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  class: {
    id: string;
    name: string;
    level: string;
  };
  subject: {
    id: string;
    name: string;
    code: string;
  };
  files: AssignmentFile[];
  _count: {
    submissions: number;
    gradedSubmissions: number;
  };
}

export interface SubmissionWithRelations extends AssignmentSubmission {
  assignment: {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    maxScore: number;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  files: SubmissionFile[];
  correctionFiles: CorrectionFile[];
}

export interface CourseResourceWithRelations extends CourseResource {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  };
  class: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
  };
}

// ============================================
// Filter Types
// ============================================

export interface AssignmentFilters {
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  status?: AssignmentStatus;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface SubmissionFilters {
  assignmentId?: string;
  status?: SubmissionStatus;
  isLate?: boolean;
}

export interface CourseResourceFilters {
  teacherId?: string;
  classId?: string;
  subjectId?: string;
  resourceType?: ResourceType;
  isPublished?: boolean;
}

// ============================================
// Stats Types
// ============================================

export interface AssignmentStats {
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
  pendingCount: number;
  averageScore: number | null;
}

export interface StudentAssignmentStats {
  totalAssignments: number;
  submittedCount: number;
  gradedCount: number;
  pendingCount: number;
  averageScore: number | null;
}
