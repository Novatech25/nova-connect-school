// Edge Function: Generate Campus Report
// Description: Generate reports for a specific campus (attendance, grades, payments, schedule)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { requireMultiCampusAccess } from '../_shared/multiCampusCheck.ts';

// Types for request/response
interface GenerateCampusReportRequest {
  schoolId: string;
  campusId: string;
  reportType: 'attendance' | 'grades' | 'payments' | 'schedule';
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

interface CampusReportSuccessResponse {
  success: true;
  reportType: string;
  campus: {
    id: string;
    name: string;
    code: string;
  };
  period: {
    start: string;
    end: string;
  };
  data: any;
  generatedAt: string;
}

interface CampusReportErrorResponse {
  success: false;
  error: 'multi_campus_not_enabled' | 'access_denied' | 'invalid_report_type' | 'campus_not_found' | 'invalid_date_range';
  message: string;
}

type CampusReportResponse = CampusReportSuccessResponse | CampusReportErrorResponse;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'access_denied',
          message: 'Missing authorization header',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'access_denied',
          message: 'Invalid authentication',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // 2. Parse request body
    const {
      schoolId,
      campusId,
      reportType,
      startDate,
      endDate,
    }: GenerateCampusReportRequest = await req.json();

    if (!schoolId || !campusId || !reportType || !startDate || !endDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_date_range',
          message: 'Missing required fields: schoolId, campusId, reportType, startDate, endDate',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 3. Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_date_range',
          message: 'Invalid date range',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 4. Validate report type
    const validReportTypes = ['attendance', 'grades', 'payments', 'schedule'];
    if (!validReportTypes.includes(reportType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_report_type',
          message: `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`,
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 5. Verify multi-campus module is enabled
    try {
      await requireMultiCampusAccess(supabase, schoolId);
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'multi_campus_not_enabled',
          message: error instanceof Error ? error.message : 'Multi-campus module not enabled',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 5.5. Verify user belongs to the specified school
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'access_denied',
          message: 'Unable to verify user school',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    if (userData.school_id !== schoolId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'access_denied',
          message: 'You can only generate reports for your own school',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 6. Verify user has permission (school_admin or accountant)
    const { data: userRole, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'access_denied',
          message: 'Unable to verify user role',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    const canViewReports =
      userRole.role === 'school_admin' ||
      userRole.role === 'super_admin' ||
      (userRole.role === 'accountant' && reportType === 'payments');

    if (!canViewReports) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'access_denied',
          message: 'You do not have permission to view this report',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 7. Retrieve campus information
    const { data: campus, error: campusError } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', campusId)
      .eq('school_id', schoolId)
      .single();

    if (campusError || !campus) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'campus_not_found',
          message: 'Campus not found',
        } as CampusReportErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // 8. Generate report based on type
    let reportData: any = {};

    switch (reportType) {
      case 'attendance':
        reportData = await generateAttendanceReport(
          supabase,
          campusId,
          startDate,
          endDate
        );
        break;

      case 'grades':
        reportData = await generateGradesReport(
          supabase,
          campusId,
          startDate,
          endDate
        );
        break;

      case 'payments':
        reportData = await generatePaymentsReport(
          supabase,
          campusId,
          startDate,
          endDate
        );
        break;

      case 'schedule':
        reportData = await generateScheduleReport(
          supabase,
          campusId,
          startDate,
          endDate
        );
        break;
    }

    // 9. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        reportType,
        campus: {
          id: campus.id,
          name: campus.name,
          code: campus.code,
        },
        period: {
          start: startDate,
          end: endDate,
        },
        data: reportData,
        generatedAt: new Date().toISOString(),
      } as CampusReportSuccessResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in generate-campus-report:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'access_denied',
        message: error.message || 'Une erreur est survenue',
      } as CampusReportErrorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// ============================================================================
// REPORT GENERATORS
// ============================================================================

async function generateAttendanceReport(
  supabase: any,
  campusId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  // Get attendance records for sessions on this campus
  const { data: sessions, error: sessionsError } = await supabase
    .from('planned_sessions')
    .select('id, session_date, class_id, classes(name, student_count)')
    .eq('campus_id', campusId)
    .gte('session_date', startDate)
    .lte('session_date', endDate);

  const sessionIds = sessions?.map((s: any) => s.id) || [];

  // Get attendance records
  const { data: attendanceRecords, error: attendanceError } = await supabase
    .from('attendance_records')
    .select('*, students(first_name, last_name)')
    .in('session_id', sessionIds);

  // Calculate statistics
  const totalSessions = sessions?.length || 0;
  const totalRecords = attendanceRecords?.length || 0;
  const presentCount =
    attendanceRecords?.filter((r: any) => r.status === 'present').length || 0;
  const absentCount =
    attendanceRecords?.filter((r: any) => r.status === 'absent').length || 0;
  const lateCount =
    attendanceRecords?.filter((r: any) => r.status === 'late').length || 0;
  const excusedCount =
    attendanceRecords?.filter((r: any) => r.status === 'excused').length || 0;

  const attendanceRate =
    totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

  return {
    summary: {
      totalSessions,
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
    },
    sessions: sessions || [],
    records: attendanceRecords || [],
  };
}

async function generateGradesReport(
  supabase: any,
  campusId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  // Get classes on this campus
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name, level')
    .eq('campus_id', campusId);

  const classIds = classes?.map((c: any) => c.id) || [];

  // Get grades for students in these classes
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('student_id, class_id, students(first_name, last_name)')
    .in('class_id', classIds);

  const studentIds = enrollments?.map((e: any) => e.student_id) || [];

  // Get grades
  const { data: grades, error: gradesError } = await supabase
    .from('grades')
    .select(
      '*, students(first_name, last_name), subjects(name), assessments(name, max_score, assessment_date)'
    )
    .in('student_id', studentIds)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Calculate statistics
  const totalGrades = grades?.length || 0;
  const averageScore =
    totalGrades > 0
      ? grades.reduce((sum: number, g: any) => sum + g.score, 0) / totalGrades
      : 0;

  return {
    summary: {
      totalClasses: classes?.length || 0,
      totalStudents: enrollments?.length || 0,
      totalGrades,
      averageScore: Math.round(averageScore * 100) / 100,
    },
    classes: classes || [],
    grades: grades || [],
  };
}

async function generatePaymentsReport(
  supabase: any,
  campusId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  // Get classes on this campus
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name')
    .eq('campus_id', campusId);

  const classIds = classes?.map((c: any) => c.id) || [];

  // Get enrollments
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('student_id, class_id')
    .in('class_id', classIds);

  const studentIds = enrollments?.map((e: any) => e.student_id) || [];

  // Get payments
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*, students(first_name, last_name), fee_types(name, amount)')
    .in('student_id', studentIds)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate);

  // Calculate statistics
  const totalPayments = payments?.length || 0;
  const totalAmount =
    payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
  const successfulPayments =
    payments?.filter((p: any) => p.status === 'completed').length || 0;
  const pendingPayments =
    payments?.filter((p: any) => p.status === 'pending').length || 0;
  const failedPayments =
    payments?.filter((p: any) => p.status === 'failed').length || 0;

  return {
    summary: {
      totalPayments,
      totalAmount,
      successfulPayments,
      pendingPayments,
      failedPayments,
    },
    payments: payments || [],
  };
}

async function generateScheduleReport(
  supabase: any,
  campusId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  // Get planned sessions for this campus
  const { data: sessions, error: sessionsError } = await supabase
    .from('planned_sessions')
    .select(
      '*, class:classes(name), teacher:users(first_name, last_name), subject:subjects(name), room:rooms(name, building)'
    )
    .eq('campus_id', campusId)
    .gte('session_date', startDate)
    .lte('session_date', endDate)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true });

  // Calculate statistics
  const totalSessions = sessions?.length || 0;
  const uniqueTeachers = new Set(sessions?.map((s: any) => s.teacher_id)).size;
  const uniqueClasses = new Set(sessions?.map((s: any) => s.class_id)).size;
  const uniqueSubjects = new Set(sessions?.map((s: any) => s.subject_id)).size;

  // Group by date
  const sessionsByDate: Record<string, any[]> = {};
  sessions?.forEach((session: any) => {
    const date = session.session_date;
    if (!sessionsByDate[date]) {
      sessionsByDate[date] = [];
    }
    sessionsByDate[date].push(session);
  });

  return {
    summary: {
      totalSessions,
      uniqueTeachers,
      uniqueClasses,
      uniqueSubjects,
    },
    sessionsByDate,
    sessions: sessions || [],
  };
}
