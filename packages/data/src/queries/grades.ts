import { getSupabaseClient } from '../client';
import { camelToSnakeKeys, snakeToCamelKeys } from '../helpers/transform';
import type {
  Grade,
  CreateGradeInput,
  UpdateGradeInput,
  BulkGradesInput,
  SubmitGradeInput,
  ApproveGradeInput,
  PublishGradeInput,
  RejectGradeInput,
  GradeFilters,
  GradeVersion,
  GradeSubmission,
  CreateGradeSubmissionInput,
  UpdateGradeSubmissionInput,
  SubmitGradeSubmissionInput,
  ApproveGradeSubmissionInput,
  RejectGradeSubmissionInput,
  GradeSubmissionFilters,
  GradeStatistics,
  StudentGradeSummary,
} from '@core/schemas/grades';

const supabase = getSupabaseClient();
let gradesRpcEnabled: boolean | null = null;


// ============================================================================
// GRADES QUERIES
// ============================================================================

export const gradeQueries = {
  /**
   * Get all grades for a school with optional filters
   */
  async getAll(schoolId: string, filters?: GradeFilters): Promise<Grade[]> {
    console.log('[grades.getAll] Starting query for schoolId:', schoolId, 'filters:', filters);

    // Try RPC function first (disable after first failure to avoid repeated 400s)
    if (gradesRpcEnabled !== false) {
      try {
        console.log('[grades.getAll] Attempting RPC function...');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_grades_with_details', {
          p_school_id: schoolId
        });

        console.log('[grades.getAll] RPC response:', { rpcError, hasData: !!rpcData, dataLength: rpcData?.length });

        if (rpcError) {
          gradesRpcEnabled = false;
        }

        // If RPC works, use it
        if (!rpcError && rpcData) {
          gradesRpcEnabled = true;
          let result = rpcData || [];

          // Apply filters in memory
          if (filters?.studentId) {
            result = result.filter((g: any) => g.student_id === filters.studentId);
          }
          if (filters?.classId) {
            result = result.filter((g: any) => g.class_id === filters.classId);
          }
          if (filters?.subjectId) {
            result = result.filter((g: any) => g.subject_id === filters.subjectId);
          }
          if (filters?.periodId) {
            result = result.filter((g: any) => g.period_id === filters.periodId);
          }
          if (filters?.status) {
            result = result.filter((g: any) => g.status === filters.status);
          }
          if (filters?.teacherId) {
            result = result.filter((g: any) => g.teacher_id === filters.teacherId);
          }
          if (filters?.gradeType) {
            result = result.filter((g: any) => g.grade_type === filters.gradeType);
          }

          console.log('[grades.getAll] RPC data processed successfully, returning', result.length, 'grades');
          // Transform to match expected Grade interface
          return result.map((g: any) => snakeToCamelKeys({
            ...g,
            student: g.student_first_name ? {
              id: g.student_id,
              firstName: g.student_first_name,
              lastName: g.student_last_name,
              matricule: g.student_matricule,
              photo: g.student_photo
            } : null,
            subject: g.subject_name ? {
              id: g.subject_id,
              name: g.subject_name,
              code: g.subject_code,
              coefficient: g.subject_coefficient
            } : null,
            class: g.class_name ? {
              id: g.class_id,
              name: g.class_name,
              level: g.class_level
            } : null,
            period: g.period_name ? {
              id: g.period_id,
              name: g.period_name,
              periodType: g.period_type
            } : null,
            teacher: g.teacher_first_name ? {
              id: g.teacher_id,
              firstName: g.teacher_first_name,
              lastName: g.teacher_last_name
            } : null,
          })) as Grade[];
        }

        console.warn('[grades.getAll] RPC failed, falling back to simple query. Error:', rpcError);
      } catch (rpcException) {
        gradesRpcEnabled = false;
        console.error('[grades.getAll] RPC threw exception:', rpcException);
      }
    }

    // Fallback: Use simple query and fetch related data separately
    try {
      console.log('[grades.getAll] Using fallback method - simple query');
      let query = supabase
        .from('grades')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (filters?.studentId) {
        query = query.eq('student_id', filters.studentId);
      }
      if (filters?.classId) {
        query = query.eq('class_id', filters.classId);
      }
      if (filters?.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
      }
      if (filters?.periodId) {
        query = query.eq('period_id', filters.periodId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
      }
      if (filters?.gradeType) {
        query = query.eq('grade_type', filters.gradeType);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[grades.getAll] Fallback query failed:', error);
        throw error;
      }

      console.log('[grades.getAll] Fallback query returned', data?.length || 0, 'grades');
      const grades = snakeToCamelKeys(data || []) as any[];

      if (grades.length === 0) {
        console.log('[grades.getAll] No grades found, returning empty array');
        return [];
      }

      // Fetch related data for all grades
      const studentIds = [...new Set(grades.map((g: any) => g.studentId).filter(Boolean))];
      const subjectIds = [...new Set(grades.map((g: any) => g.subjectId).filter(Boolean))];
      const classIds = [...new Set(grades.map((g: any) => g.classId).filter(Boolean))];
      const periodIds = [...new Set(grades.map((g: any) => g.periodId).filter(Boolean))];
      const teacherIds = [...new Set(grades.map((g: any) => g.teacherId).filter(Boolean))];

      console.log('[grades.getAll] Fetching related data for', {
        students: studentIds.length,
        subjects: subjectIds.length,
        classes: classIds.length,
        periods: periodIds.length,
        teachers: teacherIds.length
      });

      const [students, subjects, classes, periods, teachers] = await Promise.all([
        studentIds.length > 0 ? supabase.from('students').select('id, first_name, last_name, matricule, photo_url').in('id', studentIds.slice(0, 100)) : { data: [], error: null },
        subjectIds.length > 0 ? supabase.from('subjects').select('id, name, code, coefficient').in('id', subjectIds.slice(0, 100)) : { data: [], error: null },
        classIds.length > 0 ? supabase.from('classes').select('id, name, level_id').in('id', classIds.slice(0, 100)) : { data: [], error: null },
        periodIds.length > 0 ? supabase.from('periods').select('id, name, period_type').in('id', periodIds.slice(0, 100)) : { data: [], error: null },
        teacherIds.length > 0 ? supabase.from('users').select('id, first_name, last_name').in('id', teacherIds.slice(0, 100)) : { data: [], error: null },
      ]);

      console.log('[grades.getAll] Related data fetched:', {
        students: students.data?.length || 0,
        subjects: subjects.data?.length || 0,
        classes: classes.data?.length || 0,
        periods: periods.data?.length || 0,
        teachers: teachers.data?.length || 0
      });

      const studentMap = new Map(students.data?.map((s: any) => [s.id, s] as [string, any]) || []);
      const subjectMap = new Map(subjects.data?.map((s: any) => [s.id, s] as [string, any]) || []);
      const classMap = new Map(classes.data?.map((c: any) => [c.id, c] as [string, any]) || []);
      const periodMap = new Map(periods.data?.map((p: any) => [p.id, p] as [string, any]) || []);
      const teacherMap = new Map(teachers.data?.map((t: any) => [t.id, t] as [string, any]) || []);

      const result = grades.map((grade: any) => ({
        ...grade,
        student: studentMap.get(grade.studentId) ? snakeToCamelKeys(studentMap.get(grade.studentId)) : null,
        subject: subjectMap.get(grade.subjectId) ? snakeToCamelKeys(subjectMap.get(grade.subjectId)) : null,
        class: classMap.get(grade.classId) ? snakeToCamelKeys(classMap.get(grade.classId)) : null,
        period: periodMap.get(grade.periodId) ? snakeToCamelKeys(periodMap.get(grade.periodId)) : null,
        teacher: teacherMap.get(grade.teacherId) ? snakeToCamelKeys(teacherMap.get(grade.teacherId)) : null,
      }));

      console.log('[grades.getAll] Fallback method completed successfully, returning', result.length, 'grades');
      return result as Grade[];
    } catch (fallbackError) {
      console.error('[grades.getAll] Fallback method also failed:', fallbackError);
      // Return empty array instead of throwing to prevent UI from breaking
      return [];
    }
  },

  /**
   * Get a single grade by ID
   */
  async getById(id: string): Promise<Grade> {
    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    const grade = snakeToCamelKeys(data) as any;

    // Fetch related data separately
    const [student, subject, classData, period, teacher] = await Promise.all([
      supabase.from('students').select('id, first_name, last_name, matricule, photo_url').eq('id', grade.studentId).single(),
      supabase.from('subjects').select('id, name, code, coefficient').eq('id', grade.subjectId).single(),
      supabase.from('classes').select('id, name, level_id').eq('id', grade.classId).single(),
      supabase.from('periods').select('id, name, period_type').eq('id', grade.periodId).single(),
      supabase.from('users').select('id, first_name, last_name').eq('id', grade.teacherId).single(),
    ]);

    return {
      ...grade,
      student: student.data ? snakeToCamelKeys(student.data) : null,
      subject: subject.data ? snakeToCamelKeys(subject.data) : null,
      class: classData.data ? snakeToCamelKeys(classData.data) : null,
      period: period.data ? snakeToCamelKeys(period.data) : null,
      teacher: teacher.data ? snakeToCamelKeys(teacher.data) : null,
    } as Grade;
  },

  /**
   * Get grades for a student
   */
  async getByStudent(studentId: string, periodId?: string): Promise<Grade[]> {
    let query = supabase
      .from('grades')
      .select('*, student_id, subject_id, class_id, period_id, teacher_id')
      .eq('student_id', studentId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (periodId) {
      query = query.eq('period_id', periodId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // TODO: Fetch related data if needed
    return snakeToCamelKeys(data) as Grade[];
  },

  /**
   * Get grades for a class (for teacher view)
   */
  async getByClass(classId: string, subjectId: string, periodId: string): Promise<Grade[]> {
    const { data, error } = await supabase
      .from('grades')
      .select(`
        *,
        student:students(id, first_name, last_name, matricule, photo_url),
        subject:subjects(id, name, code, coefficient),
        class:classes(id, name, level_id),
        period:periods(id, name, period_type),
        teacher:users(id, first_name, last_name)
      `)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('period_id', periodId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return snakeToCamelKeys(data) as Grade[];
  },

  /**
   * Get grades for a teacher
   */
  async getByTeacher(teacherId: string, filters?: GradeFilters): Promise<Grade[]> {
    let query = supabase
      .from('grades')
      .select(`
        *,
        student:students(id, first_name, last_name, matricule, photo_url),
        subject:subjects(id, name, code, coefficient),
        class:classes(id, name, level_id),
        period:periods(id, name, period_type),
        teacher:users!grades_teacher_id_fkey(id, first_name, last_name)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }

    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }

    if (filters?.periodId) {
      query = query.eq('period_id', filters.periodId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as Grade[];
  },

  /**
   * Create a single grade
   */
  async create(input: CreateGradeInput): Promise<Grade> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const dbInput = {
      ...camelToSnakeKeys(input),
      teacher_id: userId,
    };

    const { data, error } = await supabase
      .from('grades')
      .insert(dbInput)
      .select()
      .single();

    if (error) {
      const message =
        error.message || error.details || error.hint || 'Failed to create grade';
      const wrapped = new Error(message);
      (wrapped as any).code = error.code;
      (wrapped as any).details = error.details;
      (wrapped as any).hint = error.hint;
      throw wrapped;
    }
    return snakeToCamelKeys(data) as Grade;
  },

  /**
   * Create multiple grades in bulk
   */
  async createBulk(input: BulkGradesInput): Promise<Grade[]> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const dbRecords = input.grades.map((g) => {
      const record: any = {
        school_id: input.schoolId,
        student_id: g.studentId,
        subject_id: input.subjectId,
        class_id: input.classId,
        period_id: input.periodId,
        academic_year_id: input.academicYearId,
        grade_type: input.gradeType,
        title: input.title,
        max_score: input.maxScore,
        coefficient: input.coefficient,
        weight: input.weight,
        score: g.score,
        teacher_id: userId,
      };

      if (g.comments !== undefined && g.comments !== null) {
        record.comments = g.comments;
      }
      if (input.status !== undefined && input.status !== null) {
        record.status = input.status;
        if (input.status === 'published') {
          record.published_at = new Date().toISOString();
        }
      }
      if (input.affectsReportCard !== undefined && input.affectsReportCard !== null) {
        record.affects_report_card = input.affectsReportCard;
      }

      return record;
    });

    const { error } = await supabase
      .from('grades')
      .insert(dbRecords);

    if (error) {
      const message =
        error.message || error.details || error.hint || 'Failed to create grades';
      const wrapped = new Error(message);
      (wrapped as any).code = error.code;
      (wrapped as any).details = error.details;
      (wrapped as any).hint = error.hint;
      throw wrapped;
    }
    return snakeToCamelKeys(dbRecords) as Grade[];
  },

  /**
   * Update a grade
   */
  async update(input: UpdateGradeInput): Promise<Grade> {
    const dbInput = camelToSnakeKeys(input);
    const { id, ...updateData } = dbInput;

    const { data, error } = await supabase
      .from('grades')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Grade;
  },

  /**
   * Delete a grade
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('grades')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ==========================================================================
  // WORKFLOW OPERATIONS
  // ==========================================================================

  /**
   * Submit a grade for validation
   */
  async submit(input: SubmitGradeInput): Promise<Grade> {
    const { data, error } = await supabase
      .from('grades')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Grade;
  },

  /**
   * Approve a grade (admin/supervisor)
   */
  async approve(input: ApproveGradeInput): Promise<Grade> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('grades')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Grade;
  },

  /**
   * Publish a grade (makes visible to students/parents)
   * Sends notifications to the student and their parents
   */
  async publish(input: PublishGradeInput): Promise<Grade> {
    // First, update the grade status
    const { data, error } = await supabase
      .from('grades')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) {
      console.error('[grades.publish] Error publishing grade:', error);
      throw error;
    }

    // Get current user to use as publisher
    const { data: { user } } = await supabase.auth.getUser();

    // Send notifications to student and parents
    if (user?.id) {
      const { data: notificationResult, error: notificationError } = await supabase.rpc(
        'notify_grade_published',
        {
          p_grade_id: input.id,
          p_publisher_user_id: user.id
        }
      );

      if (notificationError) {
        console.error('[grades.publish] Error sending notifications:', notificationError);
        // Don't throw - the grade is already published, just log the error
      } else {
        console.log('[grades.publish] Notifications sent:', notificationResult);
      }
    }

    console.log('[grades.publish] Grade published successfully:', input.id);
    return snakeToCamelKeys(data) as Grade;
  },

  /**
   * Reject a grade (returns to draft)
   */
  async reject(input: RejectGradeInput): Promise<Grade> {
    const { data, error } = await supabase
      .from('grades')
      .update({
        status: 'draft',
        metadata: camelToSnakeKeys({
          rejectionReason: input.reason,
          rejectedAt: new Date().toISOString(),
        }),
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as Grade;
  },

  // ==========================================================================
  // VERSION TRACKING
  // ==========================================================================

  /**
   * Get version history for a grade
   */
  async getVersions(gradeId: string): Promise<GradeVersion[]> {
    const { data, error } = await supabase
      .from('grade_versions')
      .select(`
        *,
        changed_by_user:users(id, first_name, last_name)
      `)
      .eq('grade_id', gradeId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeVersion[];
  },

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get class grade statistics
   */
  async getClassStatistics(
    classId: string,
    subjectId: string,
    periodId: string
  ): Promise<GradeStatistics> {
    const { data, error } = await supabase
      .from('grades')
      .select('score, max_score')
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .eq('period_id', periodId)
      .eq('status', 'published');

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        average: 0,
        minGrade: 0,
        maxGrade: 0,
        count: 0,
        passingCount: 0,
        failingCount: 0,
      };
    }

    const scores = data.map((g: any) => (g.score / g.max_score) * 20);
    const passingThreshold = 10;

    return {
      average: scores.reduce((a, b) => a + b, 0) / scores.length,
      minGrade: Math.min(...scores),
      maxGrade: Math.max(...scores),
      count: data.length,
      passingCount: scores.filter((s) => s >= passingThreshold).length,
      failingCount: scores.filter((s) => s < passingThreshold).length,
    };
  },

  /**
   * Get student grade summary
   */
  async getStudentSummary(studentId: string, periodId: string): Promise<StudentGradeSummary> {
    // Get all published grades for the student in the period
    const { data: grades, error } = await supabase
      .from('grades')
      .select(`
        *,
        subject:subjects(id, name, coefficient)
      `)
      .eq('student_id', studentId)
      .eq('period_id', periodId)
      .eq('status', 'published');

    if (error) throw error;

    if (!grades || grades.length === 0) {
      return {
        studentId,
        periodId,
        overallAverage: 0,
        subjectAverages: [],
        totalGrades: 0,
        rankInClass: null,
        classSize: 0,
      };
    }

    // Calculate subject averages
    const subjectGroups = grades.reduce((acc: any, grade: any) => {
      const subjectId = grade.subject_id;
      if (!acc[subjectId]) {
        acc[subjectId] = {
          subjectId: grade.subject.id,
          subjectName: grade.subject.name,
          grades: [],
        };
      }
      acc[subjectId].grades.push(grade);
      return acc;
    }, {});

    const subjectAverages = Object.values(subjectGroups).map((group: any) => {
      const totalWeight = group.grades.reduce(
        (sum: number, g: any) => sum + (g.coefficient || 1),
        0
      );
      const weightedSum = group.grades.reduce(
        (sum: number, g: any) => sum + ((g.score / g.max_score) * 20 * (g.coefficient || 1)),
        0
      );

      return {
        subjectId: group.subjectId,
        subjectName: group.subjectName,
        average: totalWeight > 0 ? weightedSum / totalWeight : 0,
        totalCoefficient: totalWeight,
        gradeCount: group.grades.length,
      };
    });

    // Calculate overall average
    const totalCoefficient = subjectAverages.reduce(
      (sum: number, s: any) => sum + s.totalCoefficient,
      0
    );
    const overallAverage =
      totalCoefficient > 0
        ? subjectAverages.reduce(
          (sum: number, s: any) => sum + s.average * s.totalCoefficient,
          0
        ) / totalCoefficient
        : 0;

    return {
      studentId,
      periodId,
      overallAverage,
      subjectAverages,
      totalGrades: grades.length,
      rankInClass: null,
      classSize: 0,
    };
  },
};

// ============================================================================
// GRADE SUBMISSIONS QUERIES
// ============================================================================

export const gradeSubmissionQueries = {
  /**
   * Get all grade submissions for a school
   */
  async getAll(schoolId: string, filters?: GradeSubmissionFilters): Promise<GradeSubmission[]> {
    let query = supabase
      .from('grade_submissions')
      .select(`
        *,
        teacher:users(id, first_name, last_name),
        class:classes(id, name, level_id),
        subject:subjects(id, name, code),
        period:periods(id, name, period_type)
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

    if (filters?.periodId) {
      query = query.eq('period_id', filters.periodId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission[];
  },

  /**
   * Get a single grade submission by ID
   */
  async getById(id: string): Promise<GradeSubmission> {
    const { data, error } = await supabase
      .from('grade_submissions')
      .select(`
        *,
        teacher:users(id, first_name, last_name),
        class:classes(id, name, level_id),
        subject:subjects(id, name, code),
        period:periods(id, name, period_type)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission;
  },

  /**
   * Get grade submissions for a teacher
   */
  async getByTeacher(
    teacherId: string,
    filters?: GradeSubmissionFilters
  ): Promise<GradeSubmission[]> {
    let query = supabase
      .from('grade_submissions')
      .select(`
        *,
        class:classes(id, name, level_id),
        subject:subjects(id, name, code),
        period:periods(id, name, period_type)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }

    if (filters?.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }

    if (filters?.periodId) {
      query = query.eq('period_id', filters.periodId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission[];
  },

  /**
   * Create a grade submission
   */
  async create(input: CreateGradeSubmissionInput): Promise<GradeSubmission> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const dbInput = {
      ...camelToSnakeKeys(input),
      teacher_id: userId,
    };

    const { data, error } = await supabase
      .from('grade_submissions')
      .insert(dbInput)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission;
  },

  /**
   * Update a grade submission
   */
  async update(input: UpdateGradeSubmissionInput): Promise<GradeSubmission> {
    const dbInput = camelToSnakeKeys(input);
    const { id, ...updateData } = dbInput;

    const { data, error } = await supabase
      .from('grade_submissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission;
  },

  /**
   * Submit a grade submission for validation
   */
  async submit(input: SubmitGradeSubmissionInput): Promise<GradeSubmission> {
    const { data, error } = await supabase
      .from('grade_submissions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission;
  },

  /**
   * Approve a grade submission
   */
  async approve(input: ApproveGradeSubmissionInput): Promise<GradeSubmission> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('grade_submissions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission;
  },

  /**
   * Reject a grade submission
   */
  async reject(input: RejectGradeSubmissionInput): Promise<GradeSubmission> {
    const { data, error } = await supabase
      .from('grade_submissions')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: input.reason,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw error;
    return snakeToCamelKeys(data) as GradeSubmission;
  },

  /**
   * Delete a grade submission
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('grade_submissions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
