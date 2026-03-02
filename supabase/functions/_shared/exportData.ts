// ============================================
// Module Premium - API Export Avancé
// Shared Helper: Export Data Fetching & Transformation
// ============================================


/**
 * Fetch data based on resource type
 */
export async function fetchExportData(
  supabaseClient: any,
  schoolId: string,
  resourceType: string,
  filters: Record<string, any>
): Promise<any[]> {
  let query: any;

  switch (resourceType) {
    case 'students':
      query = supabaseClient
        .from('students')
        .select(`
          id,
          last_name,
          first_name,
          date_of_birth,
          gender,
          enrollments (
            class_id,
            classes (
              name
            ),
            status,
            enrollment_date
          ),
          parents (
            father_name,
            mother_name,
            phone
          )
        `)
        .eq('school_id', schoolId);

      if (filters.classId) {
        query = query.contains('enrollments', [{ class_id: filters.classId }]);
      }
      if (filters.status) {
        query = query.contains('enrollments', [{ status: filters.status }]);
      }
      break;

    case 'bulletins':
      query = supabaseClient
        .from('report_cards')
        .select(`
          id,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          class_id,
          classes (
            name
          ),
          period_id,
          periods (
            name,
            start_date,
            end_date
          ),
          average,
          rank,
          mention,
          appreciation
        `)
        .eq('school_id', schoolId);

      if (filters.periodId) {
        query = query.eq('period_id', filters.periodId);
      }
      if (filters.classId) {
        query = query.eq('class_id', filters.classId);
      }
      break;

    case 'attendance':
      query = supabaseClient
        .from('attendance_records')
        .select(`
          id,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          date,
          status,
          justification,
          attendance_sessions (
            class_id,
            classes (
              name
            )
          )
        `)
        .eq('school_id', schoolId);

      if (filters.dateRange?.start) {
        query = query.gte('date', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        query = query.lte('date', filters.dateRange.end);
      }
      break;

    case 'payments':
      query = supabaseClient
        .from('payments')
        .select(`
          id,
          payment_date,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          enrollments (
            class_id,
            classes (
              name
            )
          ),
          amount,
          payment_method,
          reference,
          status,
          fee_schedules (
            fee_type
          )
        `)
        .eq('school_id', schoolId);

      if (filters.dateRange?.start) {
        query = query.gte('payment_date', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        query = query.lte('payment_date', filters.dateRange.end);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      break;

    case 'payroll':
      query = supabaseClient
        .from('payroll_entries')
        .select(`
          id,
          teacher_id,
          teachers (
            id,
            last_name,
            first_name
          ),
          period,
          base_salary,
          hours_worked,
          hourly_rate,
          gross_salary,
          deductions,
          net_salary,
          status
        `)
        .eq('school_id', schoolId);

      if (filters.period) {
        query = query.eq('period', filters.period);
      }
      if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
      }
      break;

    case 'grades':
      query = supabaseClient
        .from('grades')
        .select(`
          id,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          enrollments (
            class_id,
            classes (
              name
            )
          ),
          subject_id,
          subjects (
            name
          ),
          grade_type,
          score,
          max_score,
          coefficient,
          graded_date
        `)
        .eq('school_id', schoolId);

      if (filters.periodId) {
        query = query.eq('period_id', filters.periodId);
      }
      if (filters.subjectId) {
        query = query.eq('subject_id', filters.subjectId);
      }
      break;

    case 'schedules':
      query = supabaseClient
        .from('schedules')
        .select(`
          id,
          class_id,
          classes (
            name
          ),
          subject_id,
          subjects (
            name
          ),
          teacher_id,
          teachers (
            last_name,
            first_name
          ),
          day_of_week,
          start_time,
          end_time,
          room,
          semester,
          academic_year
        `)
        .eq('school_id', schoolId);

      if (filters.classId) {
        query = query.eq('class_id', filters.classId);
      }
      break;

    case 'lesson_logs':
      query = supabaseClient
        .from('lesson_logs')
        .select(`
          id,
          teacher_id,
          teachers (
            last_name,
            first_name
          ),
          class_id,
          classes (
            name
          ),
          subject_id,
          subjects (
            name
          ),
          date,
          topic,
          hours_count,
          content
        `)
        .eq('school_id', schoolId);

      if (filters.dateRange?.start) {
        query = query.gte('date', filters.dateRange.start);
      }
      if (filters.dateRange?.end) {
        query = query.lte('date', filters.dateRange.end);
      }
      break;

    case 'student_cards':
      query = supabaseClient
        .from('students')
        .select(`
          id,
          student_id,
          last_name,
          first_name,
          date_of_birth,
          enrollments (
            class_id,
            classes (
              name
            )
          )
        `)
        .eq('school_id', schoolId);

      if (filters.classId) {
        query = query.contains('enrollments', [{ class_id: filters.classId }]);
      }
      break;

    case 'exam_results':
      query = supabaseClient
        .from('exam_results')
        .select(`
          id,
          student_id,
          students (
            id,
            last_name,
            first_name
          ),
          exam_id,
          exams (
            title,
            exam_date
          ),
          score,
          max_score,
          mention,
          rank
        `)
        .eq('school_id', schoolId);

      if (filters.examId) {
        query = query.eq('exam_id', filters.examId);
      }
      break;

    default:
      throw new Error(`Resource type ${resourceType} not yet implemented`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch ${resourceType} data: ${error.message}`);
  }

  return data || [];
}

/**
 * Transform data according to template configuration
 */
export function transformData(
  data: any[],
  templateConfig: any,
  resourceType: string
): any[] {
  if (!data || data.length === 0) {
    return [];
  }

  if (!templateConfig.columns || templateConfig.columns.length === 0) {
    return data;
  }

  const visibleColumns = templateConfig.columns.filter((col: any) => col.visible !== false);

  return data.map((row: any) => {
    const transformedRow: any = {};

    visibleColumns.forEach((col: any) => {
      let value = getNestedValue(row, col.key);

      // Apply formatting
      if (col.format) {
        value = formatValue(value, col.format);
      }

      // Use custom header if provided
      const header = col.header || col.key;
      transformedRow[header] = value;
    });

    return transformedRow;
  });
}

/**
 * Get nested object value by key path
 */
function getNestedValue(obj: any, key: string): any {
  const keys = key.split('.');
  let value = obj;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return null;
    }
  }

  return value;
}

/**
 * Format value based on format type
 */
function formatValue(value: any, format: any): any {
  if (value === null || value === undefined) {
    return '';
  }

  switch (format.type) {
    case 'number':
      return parseFloat(value).toFixed(format.decimals || 2);

    case 'currency':
      return `${format.symbol || ''} ${parseFloat(value).toFixed(2)}`;

    case 'percentage':
      return `${parseFloat(value).toFixed(2)}%`;

    case 'date':
      return new Date(value).toLocaleDateString('fr-FR');

    case 'integer':
      return parseInt(value);

    default:
      return value;
  }
}
