import { camelToSnakeKeys, snakeToCamelKeys } from '../helpers/transform';
import { getSupabaseClient } from '../client';
import type {
  LessonLog,
  LessonLogDocument,
  CreateLessonLogInput,
  UpdateLessonLogInput,
  SubmitLessonLogInput,
  ValidateLessonLogInput,
  RejectLessonLogInput,
  DeleteLessonLogInput,
  UploadLessonLogDocumentInput,
  DeleteLessonLogDocumentInput,
  LessonLogFilters,
  LessonLogWithRelations,
  TeacherLessonStats,
  SchoolLessonStats,
} from '@core/schemas/lessonLog';

// ============================================================================
// LESSON LOGS QUERIES
// ============================================================================

export const lessonLogQueries = {
  /**
   * Get all lesson logs for a school with optional filters
   */
  async getAll(schoolId: string, filters?: LessonLogFilters) {
    let query = getSupabaseClient()
      .from('lesson_logs')
      .select(`
        *,
        planned_session:planned_sessions!left(*),
        teacher:users!lesson_logs_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(*),
        subject:subjects(*)
      `)
      .eq('school_id', schoolId)
      .order('session_date', { ascending: false })
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

    if (filters?.startDate) {
      query = query.gte('session_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('session_date', filters.endDate);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLogWithRelations[] : [];
  },

  /**
   * Get a single lesson log by ID with relations
   */
  async getById(id: string): Promise<LessonLogWithRelations> {
    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .select(`
        *,
        planned_session:planned_sessions!left(*),
        teacher:users!lesson_logs_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(*),
        subject:subjects(*),
        documents:lesson_log_documents(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as LessonLogWithRelations;
  },

  /**
   * Get lesson logs for a teacher with optional filters
   */
  async getByTeacher(teacherId: string, filters?: LessonLogFilters) {
    let query = getSupabaseClient()
      .from('lesson_logs')
      .select(`
        *,
        planned_session:planned_sessions!left(*),
        class:classes(*),
        subject:subjects(*)
      `)
      .eq('teacher_id', teacherId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }

    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }

    if (filters?.startDate) {
      query = query.gte('session_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('session_date', filters.endDate);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLogWithRelations[] : [];
  },

  /**
   * Get lesson logs for a class with optional filters
   */
  async getByClass(classId: string, filters?: Omit<LessonLogFilters, 'classId'>) {
    let query = getSupabaseClient()
      .from('lesson_logs')
      .select(`
        *,
        planned_session:planned_sessions!left(*),
        teacher:users(id, first_name, last_name),
        subject:subjects(*)
      `)
      .eq('class_id', classId)
      .eq('status', 'validated')
      .order('session_date', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('session_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('session_date', filters.endDate);
    }

    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLogWithRelations[] : [];
  },

  /**
   * Get lesson logs pending validation for a school
   */
  async getPendingValidation(schoolId: string) {
    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .select(`
        *,
        planned_session:planned_sessions!left(*),
        teacher:users!lesson_logs_teacher_id_fkey(id, first_name, last_name, email),
        class:classes(*),
        subject:subjects(*)
      `)
      .eq('school_id', schoolId)
      .eq('status', 'pending_validation')
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLogWithRelations[] : [];
  },

  /**
   * Get validated lesson logs for a teacher within a date range (for payroll)
   */
  async getValidatedByTeacher(teacherId: string, startDate: string, endDate: string) {
    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .select(`
        *,
        planned_session:planned_sessions!left(*),
        class:classes(*),
        subject:subjects(*)
      `)
      .eq('teacher_id', teacherId)
      .eq('status', 'validated')
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date', { ascending: true });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLogWithRelations[] : [];
  },

  /**
   * Get today's lesson logs for a teacher
   */
  async getTodayLessonLogs(teacherId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .select(`
        *,
        planned_session:planned_sessions!left(*),
        class:classes(*),
        subject:subjects(*)
      `)
      .eq('teacher_id', teacherId)
      .eq('session_date', today)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLogWithRelations[] : [];
  },

  /**
   * Get lesson log by planned session ID
   */
  async getByPlannedSession(plannedSessionId: string) {
    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .select('*')
      .eq('planned_session_id', plannedSessionId)
      .maybeSingle();

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLog : null;
  },

  /**
   * Create a new lesson log
   */
  async create(input: CreateLessonLogInput): Promise<LessonLog> {
    const dbInput = camelToSnakeKeys(input);

    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .insert({
        ...dbInput,
        status: 'pending_validation',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as LessonLog;
  },

  /**
   * Update a lesson log
   */
  async update(input: UpdateLessonLogInput): Promise<LessonLog> {
    const { id, ...updates } = input;
    const dbUpdates = camelToSnakeKeys(updates);

    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .update({
        ...dbUpdates,
        status: 'pending_validation',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as LessonLog;
  },

  /**
   * Submit a lesson log for validation (draft → pending_validation)
   */
  async submit(input: SubmitLessonLogInput): Promise<LessonLog> {
    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .update({
        status: 'pending_validation',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as LessonLog;
  },

  /**
   * Validate a lesson log (pending_validation → validated)
   */
  async validate(input: ValidateLessonLogInput): Promise<LessonLog> {
    const supabase = getSupabaseClient();
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('lesson_logs')
      .update({
        status: 'validated',
        validated_at: new Date().toISOString(),
        validated_by: userId,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as LessonLog;
  },

  /**
   * Reject a lesson log (pending_validation → rejected)
   */
  async reject(input: RejectLessonLogInput): Promise<LessonLog> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('lesson_logs')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: input.rejectionReason,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as LessonLog;
  },

  /**
   * Delete a lesson log (only draft status)
   */
  async delete(input: DeleteLessonLogInput): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('lesson_logs')
      .delete()
      .eq('id', input.id)
      .eq('status', 'draft');

    if (error) throw error;
  },
};

// ============================================================================
// LESSON LOG DOCUMENTS QUERIES
// ============================================================================

export const lessonLogDocumentQueries = {
  /**
   * Get all documents for a lesson log
   */
  async getByLessonLog(lessonLogId: string): Promise<LessonLogDocument[]> {
    const { data, error } = await getSupabaseClient()
      .from('lesson_log_documents')
      .select('*')
      .eq('lesson_log_id', lessonLogId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as LessonLogDocument[] : [];
  },

  /**
   * Upload a document to a lesson log
   * Note: This function expects the file to already be uploaded to Supabase Storage.
   * The filePath should be the full Storage path (e.g., 'school-id/lesson-log-id/filename').
   * Use getSupabaseClient().storage.from('lesson-documents').upload() before calling this function.
   */
  async upload(input: UploadLessonLogDocumentInput): Promise<LessonLogDocument> {
    const dbInput = camelToSnakeKeys(input);

    // Verify the file exists in Storage before inserting metadata
    const { data: fileData, error: fileError } = await getSupabaseClient()
      .storage
      .from('lesson-documents')
      .list(dbInput.file_path.split('/').slice(0, -1).join('/'), {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

    // Check if the specific file exists in the folder
    const fileName = dbInput.file_path.split('/').pop();
    const fileExists = fileData?.some((file: any) => file.name === fileName);

    if (fileError || !fileExists) {
      throw new Error(
        `File not found in Storage. Please upload the file to Supabase Storage before inserting metadata. ` +
        `Expected path: ${dbInput.file_path}`
      );
    }

    // File exists in Storage, now insert metadata
    const supabase = getSupabaseClient();
    const uploadedBy = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('lesson_log_documents')
      .insert({
        ...dbInput,
        uploaded_by: uploadedBy,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as LessonLogDocument;
  },

  /**
   * Delete a document
   */
  async delete(input: DeleteLessonLogDocumentInput): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('lesson_log_documents')
      .delete()
      .eq('id', input.id);

    if (error) throw error;
  },
};

// ============================================================================
// LESSON LOG STATS QUERIES
// ============================================================================

export const lessonLogStatsQueries = {
  /**
   * Get statistics for a teacher
   */
  async getTeacherStats(teacherId: string, startDate: string, endDate: string): Promise<TeacherLessonStats> {
    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .select('status, duration_minutes')
      .eq('teacher_id', teacherId)
      .gte('session_date', startDate)
      .lte('session_date', endDate);

    if (error) throw error;

    const stats: TeacherLessonStats = {
      teacherId,
      totalLessons: 0,
      validatedLessons: 0,
      pendingLessons: 0,
      rejectedLessons: 0,
      totalMinutes: 0,
      validatedMinutes: 0,
      pendingMinutes: 0,
      totalHours: 0,
      validatedHours: 0,
      completionRate: 0,
    };

    data?.forEach((log) => {
      const logCamel = snakeToCamelKeys(log) as LessonLog;

      stats.totalLessons++;
      stats.totalMinutes += logCamel.durationMinutes;

      if (logCamel.status === 'validated') {
        stats.validatedLessons++;
        stats.validatedMinutes += logCamel.durationMinutes;
      } else if (logCamel.status === 'pending_validation') {
        stats.pendingLessons++;
        stats.pendingMinutes += logCamel.durationMinutes;
      } else if (logCamel.status === 'rejected') {
        stats.rejectedLessons++;
      }
    });

    // Calculate hours
    stats.totalHours = Math.round(stats.totalMinutes / 60 * 100) / 100;
    stats.validatedHours = Math.round(stats.validatedMinutes / 60 * 100) / 100;

    // Calculate completion rate
    stats.completionRate = stats.totalLessons > 0
      ? Math.round((stats.validatedLessons / stats.totalLessons) * 100)
      : 0;

    return stats;
  },

  /**
   * Get statistics for a school
   */
  async getSchoolStats(schoolId: string, startDate: string, endDate: string): Promise<SchoolLessonStats> {
    // Get total teachers
    const { count: totalTeachers, error: teachersError } = await getSupabaseClient()
      .from('user_school_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'teacher');

    if (teachersError) throw teachersError;

    // Get lesson logs
    const { data, error } = await getSupabaseClient()
      .from('lesson_logs')
      .select('status, duration_minutes, teacher_id')
      .eq('school_id', schoolId)
      .gte('session_date', startDate)
      .lte('session_date', endDate);

    if (error) throw error;

    const stats: SchoolLessonStats = {
      schoolId,
      totalLessons: 0,
      validatedLessons: 0,
      pendingLessons: 0,
      totalTeachers: totalTeachers || 0,
      totalHours: 0,
      validatedHours: 0,
    };

    // Initialize local variables for minute counters
    let totalMinutes = 0;
    let validatedMinutes = 0;
    const uniqueTeachers = new Set<string>();

    data?.forEach((log) => {
      const logCamel = snakeToCamelKeys(log) as LessonLog;

      uniqueTeachers.add(logCamel.teacherId);
      stats.totalLessons++;
      totalMinutes += logCamel.durationMinutes;

      if (logCamel.status === 'validated') {
        stats.validatedLessons++;
        validatedMinutes += logCamel.durationMinutes;
      } else if (logCamel.status === 'pending_validation') {
        stats.pendingLessons++;
      }
    });

    // Calculate hours from minute counters
    stats.totalHours = Math.round(totalMinutes / 60 * 100) / 100;
    stats.validatedHours = Math.round(validatedMinutes / 60 * 100) / 100;

    return stats;
  },
};
