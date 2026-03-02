import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface CalculatePayrollRequest {
  payrollPeriodId: string;
  schoolId?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) throw new Error('Invalid authorization token');

    // Parse request body EARLY to get requested schoolId
    const { payrollPeriodId, schoolId: requestSchoolId }: CalculatePayrollRequest = await req.json();

    // Verify user role directly from JWT (Secure cryptographic claim)
    const userRole = user.user_metadata?.role;

    if (!userRole || !['school_admin', 'accountant', 'super_admin'].includes(userRole)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STRICT VALIDATION: Read the TRUE school_id from the database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    let authorizedSchoolId = userData?.school_id;

    // Zero Trust Security Policy:
    // 1. If user is Super Admin, they can operate on behalf of any school (use requested)
    if (userRole === 'super_admin') {
       authorizedSchoolId = requestSchoolId || authorizedSchoolId;
    } 
    // 2. If user is a normal Accountant/Admin, they must have a valid school in DB,
    //    and the requested school MUST MATCH their authorized DB school or be ignored.
    else {
      if (!authorizedSchoolId) {
        console.error('Security Block: User lacks bound school_id in Database.', { userId: user.id });
        return new Response(
          JSON.stringify({ success: false, message: 'Forbidden. No assigned school found in database.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (requestSchoolId && requestSchoolId !== authorizedSchoolId) {
        console.error('Security Breach Attempt: User tried to manipulate cross-school payroll.', { 
          userId: user.id, 
          dbSchool: authorizedSchoolId, 
          requestedSchool: requestSchoolId 
        });
        return new Response(
          JSON.stringify({ success: false, message: 'Forbidden. Cannot process payroll outside of your assigned school.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // override userData to ensure downstream code works with the true validated school
    const effectiveUserData = { role: userRole, school_id: authorizedSchoolId };

    // Get payroll period
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', payrollPeriodId)
      .eq('school_id', effectiveUserData.school_id)
      .single();

    if (periodError || !period) throw new Error('Payroll period not found');

    // Get all teachers with assignments in this school
    const { data: teachers, error: teachersError } = await supabase
      .from('teacher_assignments')
      .select(`
        teacher_id,
        hourly_rate,
        users(id, first_name, last_name, email)
      `)
      .eq('school_id', effectiveUserData.school_id)
      .eq('academic_year_id', period.academic_year_id)
      .not('hourly_rate', 'is', null);

    if (teachersError) throw teachersError;

    // Deduplicate by teacher_id to avoid duplicate processing
    const uniqueTeachers = new Map();
    for (const assignment of teachers || []) {
      if (!uniqueTeachers.has(assignment.teacher_id)) {
        uniqueTeachers.set(assignment.teacher_id, assignment);
      }
    }

    // For each unique teacher, calculate hours from validated lesson_logs
    for (const [teacherId, assignment] of uniqueTeachers) {
      const hourlyRate = assignment.hourly_rate;

      // Get validated lesson logs for this period
      const { data: lessonLogs, error: logsError } = await supabase
        .from('lesson_logs')
        .select('duration_minutes')
        .eq('teacher_id', teacherId)
        .eq('school_id', effectiveUserData.school_id)
        .eq('status', 'validated')
        .gte('session_date', period.start_date)
        .lte('session_date', period.end_date);

      if (logsError) {
        console.error(`Error fetching lesson logs for teacher ${teacherId}:`, logsError);
        continue;
      }

      // Calculate total hours
      const totalMinutes = lessonLogs?.reduce((sum: number, log: any) => sum + log.duration_minutes, 0) || 0;
      const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
      const validatedHours = totalHours; // All are validated

      // Check if entry already exists
      const { data: existingEntry } = await supabase
        .from('payroll_entries')
        .select('id')
        .eq('payroll_period_id', payrollPeriodId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (existingEntry) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('payroll_entries')
          .update({
            total_hours: totalHours,
            validated_hours: validatedHours,
            hourly_rate: hourlyRate,
          })
          .eq('id', existingEntry.id);

        if (updateError) {
          console.error(`Error updating payroll entry for teacher ${teacherId}:`, updateError);
          continue;
        }
      } else {
        // Create new entry
        const { error: createError } = await supabase
          .from('payroll_entries')
          .insert({
            school_id: effectiveUserData.school_id,
            payroll_period_id: payrollPeriodId,
            teacher_id: teacherId,
            total_hours: totalHours,
            validated_hours: validatedHours,
            hourly_rate: hourlyRate,
            status: 'draft',
          });

        if (createError) {
          console.error(`Error creating payroll entry for teacher ${teacherId}:`, createError);
          continue;
        }
      }
    }

    // Update period totals using a fresh query for accurate data
    const { data: allEntries } = await supabase
      .from('payroll_entries')
      .select('net_amount')
      .eq('payroll_period_id', payrollPeriodId);

    const totalAmount = allEntries?.reduce((sum: number, entry: any) => sum + (entry.net_amount || 0), 0) || 0;
    const totalTeachers = allEntries?.length || 0;

    await supabase
      .from('payroll_periods')
      .update({
        total_amount: totalAmount,
        total_teachers: totalTeachers,
      })
      .eq('id', payrollPeriodId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Payroll calculated for ${totalTeachers} teachers`,
        entriesCount: totalTeachers,
        totalAmount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error calculating payroll:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
