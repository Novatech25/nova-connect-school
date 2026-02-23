import { getSupabaseClient } from '../client';
import { camelToSnakeKeys, snakeToCamelKeys } from '../helpers/transform';
import type {
  Assignment,
  AssignmentWithRelations,
  AssignmentFilters,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  AssignmentFile,
  AssignmentSubmission,
  SubmissionWithRelations,
  SubmissionFilters,
  CreateSubmissionInput,
  GradeSubmissionInput,
  SubmissionFile,
  CorrectionFile,
  AssignmentStats,
  CourseResource,
  CourseResourceWithRelations,
  CourseResourceFilters,
  CreateCourseResourceInput,
  UpdateCourseResourceInput,
} from '@core/schemas/elearning';

// ============================================
// ASSIGNMENT QUERIES
// ============================================

export const assignmentQueries = {
  async getAll(schoolId: string, filters?: AssignmentFilters): Promise<AssignmentWithRelations[]> {
    let query = getSupabaseClient()
      .from('assignments')
      .select(`
        *,
        teacher:users!assignments_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(id, name, level),
        subject:subjects(id, name, code),
        files:assignment_files(*)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (filters?.teacherId) {
      query = query.eq('teacher_id', filters.teacherId);
    }
    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }
    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.dateRange) {
      query = query.gte('due_date', filters.dateRange.start).lte('due_date', filters.dateRange.end);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform and add counts
    const assignments = snakeToCamelKeys(data) as AssignmentWithRelations[];

    // Get submission counts for each assignment
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissionCounts } = await getSupabaseClient()
      .from('assignment_submissions')
      .select('assignment_id, status')
      .in('assignment_id', assignmentIds);

    const countsByAssignment = assignmentIds.reduce((acc, id) => {
      const assignmentSubmissions = submissionCounts?.filter(s => s.assignment_id === id) || [];
      acc[id] = {
        submissions: assignmentSubmissions.length,
        gradedSubmissions: assignmentSubmissions.filter(s => ['graded', 'returned'].includes(s.status || '')).length,
      };
      return acc;
    }, {} as Record<string, { submissions: number; gradedSubmissions: number }>);

    return assignments.map(assignment => ({
      ...assignment,
      _count: countsByAssignment[assignment.id] || { submissions: 0, gradedSubmissions: 0 },
    }));
  },

  async getById(id: string): Promise<AssignmentWithRelations | null> {
    const { data, error } = await getSupabaseClient()
      .from('assignments')
      .select(`
        *,
        teacher:users!assignments_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(id, name, level),
        subject:subjects(id, name, code),
        files:assignment_files(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const assignment = snakeToCamelKeys(data) as AssignmentWithRelations;

    // Get submission counts
    const { data: submissionCounts } = await getSupabaseClient()
      .from('assignment_submissions')
      .select('status')
      .eq('assignment_id', id);

    const submissions = submissionCounts || [];
    assignment._count = {
      submissions: submissions.length,
      gradedSubmissions: submissions.filter(s => ['graded', 'returned'].includes(s.status || '')).length,
    };

    return assignment;
  },

  async getByTeacher(teacherId: string, filters?: Omit<AssignmentFilters, 'teacherId'>): Promise<AssignmentWithRelations[]> {
    let query = getSupabaseClient()
      .from('assignments')
      .select(`
        *,
        teacher:users!assignments_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(id, name, level),
        subject:subjects(id, name, code),
        files:assignment_files(*)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }
    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.dateRange) {
      query = query.gte('due_date', filters.dateRange.start).lte('due_date', filters.dateRange.end);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform and add counts
    const assignments = snakeToCamelKeys(data) as AssignmentWithRelations[];

    // Get submission counts for each assignment
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissionCounts } = await getSupabaseClient()
      .from('assignment_submissions')
      .select('assignment_id, status')
      .in('assignment_id', assignmentIds);

    const countsByAssignment = assignmentIds.reduce((acc, id) => {
      const assignmentSubmissions = submissionCounts?.filter(s => s.assignment_id === id) || [];
      acc[id] = {
        submissions: assignmentSubmissions.length,
        gradedSubmissions: assignmentSubmissions.filter(s => ['graded', 'returned'].includes(s.status || '')).length,
      };
      return acc;
    }, {} as Record<string, { submissions: number; gradedSubmissions: number }>);

    return assignments.map(assignment => ({
      ...assignment,
      _count: countsByAssignment[assignment.id] || { submissions: 0, gradedSubmissions: 0 },
    }));
  },

  async getByClass(classId: string, filters?: Omit<AssignmentFilters, 'classId'>): Promise<AssignmentWithRelations[]> {
    let query = getSupabaseClient()
      .from('assignments')
      .select(`
        *,
        teacher:users!assignments_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(id, name, level),
        subject:subjects(id, name, code),
        files:assignment_files(*)
      `)
      .eq('class_id', classId)
      .eq('status', 'published')
      .order('due_date', { ascending: true });

    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform and add counts
    const assignments = snakeToCamelKeys(data) as AssignmentWithRelations[];

    // Get submission counts for each assignment
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissionCounts } = await getSupabaseClient()
      .from('assignment_submissions')
      .select('assignment_id, status')
      .in('assignment_id', assignmentIds);

    const countsByAssignment = assignmentIds.reduce((acc, id) => {
      const assignmentSubmissions = submissionCounts?.filter(s => s.assignment_id === id) || [];
      acc[id] = {
        submissions: assignmentSubmissions.length,
        gradedSubmissions: assignmentSubmissions.filter(s => ['graded', 'returned'].includes(s.status || '')).length,
      };
      return acc;
    }, {} as Record<string, { submissions: number; gradedSubmissions: number }>);

    return assignments.map(assignment => ({
      ...assignment,
      _count: countsByAssignment[assignment.id] || { submissions: 0, gradedSubmissions: 0 },
    }));
  },

  async getUpcoming(classId: string, limit: number = 5): Promise<AssignmentWithRelations[]> {
    const { data, error } = await getSupabaseClient()
      .from('assignments')
      .select(`
        *,
        teacher:users!assignments_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(id, name, level),
        subject:subjects(id, name, code),
        files:assignment_files(*)
      `)
      .eq('class_id', classId)
      .eq('status', 'published')
      .gte('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(limit);

    if (error) throw error;

    // Transform and add counts
    const assignments = snakeToCamelKeys(data) as AssignmentWithRelations[];

    // Get submission counts for each assignment
    const assignmentIds = assignments.map(a => a.id);
    const { data: submissionCounts } = await getSupabaseClient()
      .from('assignment_submissions')
      .select('assignment_id, status')
      .in('assignment_id', assignmentIds);

    const countsByAssignment = assignmentIds.reduce((acc, id) => {
      const assignmentSubmissions = submissionCounts?.filter(s => s.assignment_id === id) || [];
      acc[id] = {
        submissions: assignmentSubmissions.length,
        gradedSubmissions: assignmentSubmissions.filter(s => ['graded', 'returned'].includes(s.status || '')).length,
      };
      return acc;
    }, {} as Record<string, { submissions: number; gradedSubmissions: number }>);

    return assignments.map(assignment => ({
      ...assignment,
      _count: countsByAssignment[assignment.id] || { submissions: 0, gradedSubmissions: 0 },
    }));
  },

  async create(input: CreateAssignmentInput): Promise<Assignment> {
    const dbInput = camelToSnakeKeys({
      ...input,
      status: 'draft',
    });

    const { data, error } = await getSupabaseClient()
      .from('assignments')
      .insert(dbInput)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Assignment;
  },

  async update(id: string, input: UpdateAssignmentInput): Promise<Assignment> {
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('assignments')
      .update(dbInput)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Assignment;
  },

  async publish(id: string): Promise<Assignment> {
    const { data, error } = await getSupabaseClient()
      .from('assignments')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'draft')
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Assignment;
  },

  async close(id: string): Promise<Assignment> {
    const { data, error } = await getSupabaseClient()
      .from('assignments')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'published')
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Assignment;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('assignments')
      .delete()
      .eq('id', id)
      .eq('status', 'draft');

    if (error) throw error;
  },
};

// ============================================
// ASSIGNMENT FILE QUERIES
// ============================================

export const assignmentFileQueries = {
  async getByAssignment(assignmentId: string): Promise<AssignmentFile[]> {
    const { data, error } = await getSupabaseClient()
      .from('assignment_files')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('uploaded_at', { ascending: true });

    if (error) throw error;
    return snakeToCamelKeys(data) as AssignmentFile[];
  },

  async upload(input: {
    assignmentId: string;
    schoolId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
  }): Promise<AssignmentFile> {
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('assignment_files')
      .insert(dbInput)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AssignmentFile;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('assignment_files')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================
// SUBMISSION QUERIES
// ============================================

export const submissionQueries = {
  async getByAssignment(assignmentId: string): Promise<SubmissionWithRelations[]> {
    const { data, error } = await getSupabaseClient()
      .from('assignment_submissions')
      .select(`
        *,
        assignment:assignments(id, title, description, due_date, max_score),
        student:students(id, first_name, last_name),
        files:submission_files(*),
        correction_files:correction_files(*)
      `)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return snakeToCamelKeys(data) as SubmissionWithRelations[];
  },

  async getByStudent(studentId: string, filters?: SubmissionFilters): Promise<SubmissionWithRelations[]> {
    let query = getSupabaseClient()
      .from('assignment_submissions')
      .select(`
        *,
        assignment:assignments(id, title, description, due_date, max_score),
        student:students(id, first_name, last_name),
        files:submission_files(*),
        correction_files:correction_files(*)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (filters?.assignmentId) {
      query = query.eq('assignment_id', filters.assignmentId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.isLate !== undefined) {
      query = query.eq('is_late', filters.isLate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as SubmissionWithRelations[];
  },

  async getById(id: string): Promise<SubmissionWithRelations | null> {
    const { data, error } = await getSupabaseClient()
      .from('assignment_submissions')
      .select(`
        *,
        assignment:assignments(id, title, description, due_date, max_score),
        student:students(id, first_name, last_name),
        files:submission_files(*),
        correction_files:correction_files(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return snakeToCamelKeys(data) as SubmissionWithRelations;
  },

  async create(input: CreateSubmissionInput): Promise<AssignmentSubmission> {
    const dbInput = camelToSnakeKeys({
      ...input,
      status: 'pending',
    });

    const { data, error } = await getSupabaseClient()
      .from('assignment_submissions')
      .insert(dbInput)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AssignmentSubmission;
  },

  async submit(id: string): Promise<AssignmentSubmission> {
    // First, get the assignment to check due date
    const { data: submission } = await getSupabaseClient()
      .from('assignment_submissions')
      .select('assignment_id')
      .eq('id', id)
      .single();

    if (!submission) throw new Error('Submission not found');

    const { data: assignment } = await getSupabaseClient()
      .from('assignments')
      .select('due_date, allow_late_submission')
      .eq('id', submission.assignment_id)
      .single();

    if (!assignment) throw new Error('Assignment not found');

    const now = new Date();
    const dueDate = new Date(assignment.due_date);
    const isLate = now > dueDate;

    if (isLate && !assignment.allow_late_submission) {
      throw new Error('Late submissions are not allowed for this assignment');
    }

    const { data, error } = await getSupabaseClient()
      .from('assignment_submissions')
      .update({
        status: 'submitted',
        submitted_at: now.toISOString(),
        is_late: isLate,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AssignmentSubmission;
  },

  async grade(id: string, input: GradeSubmissionInput): Promise<AssignmentSubmission> {
    const dbInput = camelToSnakeKeys({
      ...input,
      status: 'graded',
      gradedAt: new Date().toISOString(),
    });

    const { data, error } = await getSupabaseClient()
      .from('assignment_submissions')
      .update(dbInput)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AssignmentSubmission;
  },

  async return(id: string): Promise<AssignmentSubmission> {
    const { data, error } = await getSupabaseClient()
      .from('assignment_submissions')
      .update({
        status: 'returned',
        returned_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'graded')
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AssignmentSubmission;
  },

  async getStats(assignmentId: string): Promise<AssignmentStats> {
    // Get total students in the class
    const { data: assignment } = await getSupabaseClient()
      .from('assignments')
      .select('class_id')
      .eq('id', assignmentId)
      .single();

    if (!assignment) throw new Error('Assignment not found');

    const { count: totalStudents } = await getSupabaseClient()
      .from('class_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', assignment.class_id)
      .eq('status', 'active');

    // Get submissions stats
    const { data: submissions } = await getSupabaseClient()
      .from('assignment_submissions')
      .select('status, score')
      .eq('assignment_id', assignmentId);

    const submittedCount = submissions?.filter(s => s.status !== 'pending').length || 0;
    const gradedCount = submissions?.filter(s => ['graded', 'returned'].includes(s.status || '')).length || 0;
    const pendingCount = submissions?.filter(s => s.status === 'pending').length || 0;

    const gradedSubmissions = submissions?.filter(s => s.score !== null) || [];
    const averageScore = gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions.length
      : null;

    return {
      totalStudents: totalStudents || 0,
      submittedCount,
      gradedCount,
      pendingCount,
      averageScore,
    };
  },
};

// ============================================
// SUBMISSION FILE QUERIES
// ============================================

export const submissionFileQueries = {
  async getBySubmission(submissionId: string): Promise<SubmissionFile[]> {
    const { data, error } = await getSupabaseClient()
      .from('submission_files')
      .select('*')
      .eq('submission_id', submissionId)
      .order('uploaded_at', { ascending: true });

    if (error) throw error;
    return snakeToCamelKeys(data) as SubmissionFile[];
  },

  async upload(input: {
    submissionId: string;
    schoolId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  }): Promise<SubmissionFile> {
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('submission_files')
      .insert(dbInput)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as SubmissionFile;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('submission_files')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================
// CORRECTION FILE QUERIES
// ============================================

export const correctionFileQueries = {
  async getBySubmission(submissionId: string): Promise<CorrectionFile[]> {
    const { data, error } = await getSupabaseClient()
      .from('correction_files')
      .select('*')
      .eq('submission_id', submissionId)
      .order('uploaded_at', { ascending: true });

    if (error) throw error;
    return snakeToCamelKeys(data) as CorrectionFile[];
  },

  async upload(input: {
    submissionId: string;
    schoolId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
  }): Promise<CorrectionFile> {
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('correction_files')
      .insert(dbInput)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as CorrectionFile;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('correction_files')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================
// COURSE RESOURCE QUERIES
// ============================================

export const courseResourceQueries = {
  async getAll(schoolId: string, filters?: CourseResourceFilters): Promise<CourseResourceWithRelations[]> {
    let query = getSupabaseClient()
      .from('course_resources')
      .select(`
        *,
        teacher:users!course_resources_teacher_id_fkey(id, first_name, last_name),
        class:classes(id, name),
        subject:subjects(id, name)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (filters?.teacherId) {
      query = query.eq('teacher_id', filters.teacherId);
    }
    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }
    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters?.isPublished !== undefined) {
      query = query.eq('is_published', filters.isPublished);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as CourseResourceWithRelations[];
  },

  async getByTeacher(teacherId: string, filters?: Omit<CourseResourceFilters, 'teacherId'>): Promise<CourseResourceWithRelations[]> {
    let query = getSupabaseClient()
      .from('course_resources')
      .select(`
        *,
        teacher:users!course_resources_teacher_id_fkey(id, first_name, last_name),
        class:classes(id, name),
        subject:subjects(id, name)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }
    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }
    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters?.isPublished !== undefined) {
      query = query.eq('is_published', filters.isPublished);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as CourseResourceWithRelations[];
  },

  async getByClass(classId: string, subjectId?: string): Promise<CourseResourceWithRelations[]> {
    let query = getSupabaseClient()
      .from('course_resources')
      .select(`
        *,
        teacher:users!course_resources_teacher_id_fkey(id, first_name, last_name),
        class:classes(id, name),
        subject:subjects(id, name)
      `)
      .eq('class_id', classId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as CourseResourceWithRelations[];
  },

  async getById(id: string): Promise<CourseResourceWithRelations | null> {
    const { data, error } = await getSupabaseClient()
      .from('course_resources')
      .select(`
        *,
        teacher:users!course_resources_teacher_id_fkey(id, first_name, last_name),
        class:classes(id, name),
        subject:subjects(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return snakeToCamelKeys(data) as CourseResourceWithRelations;
  },

  async create(input: CreateCourseResourceInput): Promise<CourseResource> {
    const dbInput = camelToSnakeKeys({
      ...input,
      isPublished: false,
    });

    const { data, error } = await getSupabaseClient()
      .from('course_resources')
      .insert(dbInput)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as CourseResource;
  },

  async update(id: string, input: UpdateCourseResourceInput): Promise<CourseResource> {
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('course_resources')
      .update(dbInput)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as CourseResource;
  },

  async publish(id: string): Promise<CourseResource> {
    const { data, error } = await getSupabaseClient()
      .from('course_resources')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as CourseResource;
  },

  async unpublish(id: string): Promise<CourseResource> {
    const { data, error } = await getSupabaseClient()
      .from('course_resources')
      .update({
        is_published: false,
        published_at: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as CourseResource;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('course_resources')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
