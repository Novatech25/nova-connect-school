import { camelToSnakeKeys, snakeToCamelKeys } from '../helpers/transform';
import { getSupabaseClient } from '../client';
import type {
  AttendanceSession,
  AttendanceRecord,
  CreateAttendanceSessionInput,
  UpdateAttendanceSessionInput,
  SubmitAttendanceSessionInput,
  ValidateAttendanceSessionInput,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  BulkAttendanceRecordsInput,
  AttendanceSessionFilters,
  AttendanceStats,
  StudentAttendanceSummary,
} from '@core/schemas/attendance';

// ============================================================================
// ATTENDANCE SESSIONS QUERIES
// ============================================================================

export const attendanceSessionQueries = {
  /**
   * Get all attendance sessions for a school with optional filters
   */
  async getAll(schoolId: string, filters?: AttendanceSessionFilters) {
    let query = getSupabaseClient()
      .from('attendance_sessions')
      .select(`
        *,
        planned_session:planned_sessions(*),
        teacher:users(id, first_name, last_name),
        class:classes(*)
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
    return data ? snakeToCamelKeys(data) as AttendanceSession[] : [];
  },

  /**
   * Get a single attendance session by ID with relations
   */
  async getById(id: string) {
    const { data, error } = await getSupabaseClient()
      .from('attendance_sessions')
      .select(`
        *,
        planned_session:planned_sessions(*),
        teacher:users(id, first_name, last_name),
        class:classes(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AttendanceSession;
  },

  /**
   * Get attendance sessions for a teacher on a specific date
   */
  async getByTeacher(teacherId: string, date: string) {
    const { data, error } = await getSupabaseClient()
      .from('attendance_sessions')
      .select(`
        *,
        planned_session:planned_sessions(*),
        class:classes(*)
      `)
      .eq('teacher_id', teacherId)
      .eq('session_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as AttendanceSession[] : [];
  },

  /**
   * Get attendance session by planned session ID
   */
  async getByPlannedSession(plannedSessionId: string) {
    const { data, error } = await getSupabaseClient()
      .from('attendance_sessions')
      .select(`
        *,
        planned_session:planned_sessions(*),
        teacher:users(id, first_name, last_name),
        class:classes(*)
      `)
      .eq('planned_session_id', plannedSessionId)
      .maybeSingle();

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as AttendanceSession : null;
  },

  /**
   * Get today's attendance sessions for a teacher
   * Returns planned sessions for today with their associated attendance sessions
   */
  async getTodaySessions(teacherId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await getSupabaseClient()
      .from('planned_sessions')
      .select(`
        *,
        attendance_session:attendance_sessions(*)
      `)
      .eq('teacher_id', teacherId)
      .eq('date', today)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as any[] : [];
  },

  /**
   * Create a new attendance session
   */
  async create(input: CreateAttendanceSessionInput) {
    const dbInput = camelToSnakeKeys(input);
    const supabase = getSupabaseClient();

    // Check if session already exists for this planned session and date
    const { data: existingSession, error: checkError } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('planned_session_id', dbInput.planned_session_id)
      .eq('session_date', dbInput.session_date)
      .maybeSingle();

    if (checkError) {
      console.error("Supabase check session error:", checkError);
      throw new Error(checkError.message || "Erreur lors de la vérification de la séance d'appel");
    }

    if (existingSession) {
      // If it exists, returning it avoids duplicate key constraint violation
      // It will just be used to attach the attendance records to the same session
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select()
        .eq('id', existingSession.id)
        .single();
        
      if (error) {
        throw new Error(error.message);
      }
      return snakeToCamelKeys(data) as AttendanceSession;
    }

    // Create new session
    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert(dbInput)
      .select()
      .single();

    if (error) {
      console.error("Supabase create session error:", error);
      throw new Error(error.message || "Erreur lors de la création de la séance d'appel");
    }
    return snakeToCamelKeys(data) as AttendanceSession;
  },

  /**
   * Update an attendance session
   */
  async update(input: UpdateAttendanceSessionInput) {
    const { id, ...updates } = input;
    const dbUpdates = camelToSnakeKeys(updates);

    const { data, error } = await getSupabaseClient()
      .from('attendance_sessions')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AttendanceSession;
  },

  /**
   * Submit an attendance session (change status from draft to submitted)
   */
  async submit(input: SubmitAttendanceSessionInput) {
    const { data, error } = await getSupabaseClient()
      .from('attendance_sessions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        ...(input.notes !== undefined && { notes: input.notes }),
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AttendanceSession;
  },

  /**
   * Validate an attendance session (change status from submitted to validated)
   */
  async validate(input: ValidateAttendanceSessionInput) {
    const supabase = getSupabaseClient();
    const validatedBy = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({
        status: 'validated',
        validated_at: new Date().toISOString(),
        validated_by: validatedBy,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AttendanceSession;
  },

  /**
   * Delete an attendance session
   */
  async delete(id: string) {
    const { error } = await getSupabaseClient()
      .from('attendance_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// ATTENDANCE RECORDS QUERIES
// ============================================================================

export const attendanceRecordQueries = {
  /**
   * Get all attendance records for a session
   */
  async getBySession(sessionId: string) {
    const { data, error } = await getSupabaseClient()
      .from('attendance_records')
      .select(`
        *,
        student:students(id, first_name, last_name, photo)
      `)
      .eq('attendance_session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as AttendanceRecord[] : [];
  },

  /**
   * Get attendance history for a student
   */
  async getByStudent(studentId: string, startDate?: string, endDate?: string) {
    let query = getSupabaseClient()
      .from('attendance_records')
      .select(`
        *,
        attendance_session:attendance_sessions(
          id,
          session_date,
          planned_session:planned_sessions(
            subject_name,
            start_time,
            end_time
          ),
          class:classes(name, level)
        )
      `)
      .eq('student_id', studentId)
      .order('marked_at', { ascending: false });

    if (startDate) {
      query = query.gte('marked_at', startDate);
    }

    if (endDate) {
      query = query.lte('marked_at', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as AttendanceRecord[] : [];
  },

  /**
   * Get attendance for a student on a specific date
   */
  async getByStudentAndDate(studentId: string, date: string) {
    const { data, error } = await getSupabaseClient()
      .from('attendance_records')
      .select(`
        *,
        attendance_session:attendance_sessions(
          id,
          session_date,
          planned_session:planned_sessions(*),
          class:classes(*)
        )
      `)
      .eq('student_id', studentId)
      .eq('attendance_session.session_date', date)
      .order('marked_at', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) as AttendanceRecord[] : [];
  },

  /**
   * Create a single attendance record
   */
  async create(input: CreateAttendanceRecordInput) {
    const supabase = getSupabaseClient();
    const dbInput = camelToSnakeKeys(input);
    const markedBy = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        ...dbInput,
        marked_by: markedBy,
        marked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AttendanceRecord;
  },

  /**
   * Create multiple attendance records in bulk
   */
  async createBulk(records: BulkAttendanceRecordsInput) {
    const supabase = getSupabaseClient();
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const dbRecords = records.map((record) => ({
      ...camelToSnakeKeys(record),
      marked_by: userId,
      marked_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(dbRecords, {
        onConflict: 'attendance_session_id,student_id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
       console.error("Supabase bulk insert error:", error);
       throw new Error(error.message || "Erreur lors de l'enregistrement des présences");
    }
    return data ? snakeToCamelKeys(data) as AttendanceRecord[] : [];
  },

  /**
   * Update an attendance record
   */
  async update(input: UpdateAttendanceRecordInput) {
    const { id, ...updates } = input;
    const dbUpdates = camelToSnakeKeys(updates);

    const { data, error } = await getSupabaseClient()
      .from('attendance_records')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as AttendanceRecord;
  },

  /**
   * Delete an attendance record
   */
  async delete(id: string) {
    const { error } = await getSupabaseClient()
      .from('attendance_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get history for a specific attendance record
   */
  async getRecordHistory(recordId: string) {
    const { data, error } = await getSupabaseClient()
      .from('attendance_record_history')
      .select(`
        *,
        marked_by_user:users!marked_by(id, first_name, last_name, email)
      `)
      .eq('attendance_record_id', recordId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ? snakeToCamelKeys(data) : [];
  },

  /**
   * Get conflicting records (overridden) for a school
   */
  async getConflictingRecords(schoolId: string, filters?: {
    startDate?: string;
    endDate?: string;
    classId?: string;
    recordStatus?: 'auto' | 'confirmed' | 'overridden' | 'manual';
  }) {
    let query = getSupabaseClient()
      .from('attendance_records')
      .select(`
        *,
        student:students(id, first_name, last_name, photo),
        attendance_session:attendance_sessions(
          id,
          session_date,
          class:classes(name, level),
          planned_session:planned_sessions(subject_name)
        )
      `)
      .eq('school_id', schoolId)
      .order('marked_at', { ascending: false });

    // Filter by record status if specified
    if (filters?.recordStatus) {
      query = query.eq('record_status', filters.recordStatus);
    } else {
      // By default, only show overridden records (conflicts)
      query = query.eq('record_status', 'overridden');
    }

    // Apply additional filters
    if (filters?.classId) {
      query = query.eq('attendance_session.class_id', filters.classId);
    }

    if (filters?.startDate) {
      query = query.gte('marked_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('marked_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ? snakeToCamelKeys(data) : [];
  },
};

// ============================================================================
// ATTENDANCE STATS QUERIES
// ============================================================================

export const attendanceStatsQueries = {
  /**
   * Get attendance statistics for a school
   */
  async getAttendanceStats(schoolId: string, filters?: {
    startDate?: string;
    endDate?: string;
    classId?: string;
  }): Promise<AttendanceStats> {
    let query = getSupabaseClient()
      .from('attendance_records')
      .select('status', { count: 'exact' })
      .eq('school_id', schoolId);

    if (filters?.classId) {
      query = query.eq('attendance_session.class_id', filters.classId);
    }

    if (filters?.startDate) {
      query = query.gte('marked_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('marked_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats: AttendanceStats = {
      total: data?.length || 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0,
    };

    data?.forEach((record) => {
      stats[record.status as keyof AttendanceStats]++;
    });

    // Calculate attendance rate (present + excused) / total
    const attended = stats.present + stats.excused;
    stats.attendanceRate = stats.total > 0 ? Math.round((attended / stats.total) * 100) : 0;

    return stats;
  },

  /**
   * Get attendance summary by student
   */
  async getAttendanceByStudent(
    schoolId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      classId?: string;
    }
  ): Promise<StudentAttendanceSummary[]> {
    // This is a complex query that would be better handled by a database view or function
    // For now, we'll fetch all records and aggregate in the application
    let query = getSupabaseClient()
      .from('attendance_records')
      .select(`
        *,
        student:students(id, first_name, last_name)
      `)
      .eq('school_id', schoolId)
      .order('marked_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('marked_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('marked_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate by student
    const studentMap = new Map<string, StudentAttendanceSummary>();

    data?.forEach((record: any) => {
      const recordCamel = snakeToCamelKeys(record) as AttendanceRecord;
      const studentId = recordCamel.studentId;
      const student = record.student;

      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId,
          studentName: `${student.first_name} ${student.last_name}`,
          totalSessions: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0,
          unjustifiedAbsences: 0,
        });
      }

      const summary = studentMap.get(studentId)!;
      summary.totalSessions++;
      summary[recordCamel.status]++;

      // Count unjustified absences (absent without justification)
      if (recordCamel.status === 'absent' && !recordCamel.justification) {
        summary.unjustifiedAbsences++;
      }
    });

    // Calculate attendance rates
    studentMap.forEach((summary) => {
      const attended = summary.present + summary.excused;
      summary.attendanceRate = summary.totalSessions > 0
        ? Math.round((attended / summary.totalSessions) * 100)
        : 0;
    });

    return Array.from(studentMap.values());
  },

  /**
   * Get fusion statistics for a school
   */
  async getFusionStats(schoolId: string, filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    let query = getSupabaseClient()
      .from('attendance_records')
      .select('record_status, source, original_source')
      .eq('school_id', schoolId)
      .not('record_status', 'is', null);

    if (filters?.startDate) {
      query = query.gte('marked_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('marked_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate the data
    const stats = {
      totalFusions: 0,
      autoConfirmed: 0,
      overridden: 0,
      qrOnly: 0,
      manualOnly: 0,
      total: data?.length || 0,
      byRecordStatus: {
        auto: 0,
        confirmed: 0,
        overridden: 0,
        manual: 0,
      },
      bySource: {
        qr_scan: 0,
        teacher_manual: 0,
      },
    };

    data?.forEach((record) => {
      // Count by record status
      if (record.record_status) {
        stats.byRecordStatus[record.record_status as keyof typeof stats.byRecordStatus]++;
      }

      // Count by source
      if (record.source) {
        stats.bySource[record.source as keyof typeof stats.bySource]++;
      }

      // Count specific fusion metrics
      if (record.record_status === 'overridden') {
        stats.totalFusions++;
        stats.overridden++;
      }
      if (record.record_status === 'confirmed') {
        stats.autoConfirmed++;
      }
      if (record.source === 'qr_scan' && record.record_status === 'auto') {
        stats.qrOnly++;
      }
      if (record.source === 'teacher_manual' && record.record_status === 'manual') {
        stats.manualOnly++;
      }
    });

    return stats;
  },
};
