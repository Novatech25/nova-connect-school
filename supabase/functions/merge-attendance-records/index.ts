// Edge Function: Merge Attendance Records
// Description: Manually merge attendance records for conflict resolution

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Types for request/response
interface MergeAttendanceRecordRequest {
  attendanceRecordId: string;
  newStatus: 'present' | 'absent' | 'late' | 'excused';
  recordStatus: 'confirmed' | 'overridden';
  justification?: string;
  comment?: string;
}

interface MergeAttendanceRecordSuccessResponse {
  success: true;
  attendanceRecord: any;
}

interface MergeAttendanceRecordErrorResponse {
  success: false;
  error: string;
  message: string;
}

type MergeAttendanceRecordResponse =
  | MergeAttendanceRecordSuccessResponse
  | MergeAttendanceRecordErrorResponse;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse request body
    const {
      attendanceRecordId,
      newStatus,
      recordStatus,
      justification,
      comment,
    }: MergeAttendanceRecordRequest = await req.json();

    // 2. Validate required fields
    if (!attendanceRecordId || !newStatus || !recordStatus) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'validation_error',
          message: 'Missing required fields: attendanceRecordId, newStatus, recordStatus',
        } as MergeAttendanceRecordErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 3. Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'unauthorized',
          message: 'Missing authorization header',
        } as MergeAttendanceRecordErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'unauthorized',
          message: 'Invalid authorization token',
        } as MergeAttendanceRecordErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // 5. Fetch the attendance record
    const { data: existingRecord, error: recordError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', attendanceRecordId)
      .single();

    if (recordError || !existingRecord) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'not_found',
          message: 'Attendance record not found',
        } as MergeAttendanceRecordErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // 6. Check user permissions (admin or supervisor only)
    const { data: userRole } = await supabase
      .from('user_school_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('school_id', existingRecord.school_id)
      .single();

    const userRoleType = userRole?.role;
    if (!['school_admin', 'supervisor', 'teacher'].includes(userRoleType || '')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'forbidden',
          message: 'Only school admins, supervisors, and teachers can merge attendance records',
        } as MergeAttendanceRecordErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // 7. Check if session is still in draft (for teachers)
    if (userRoleType === 'teacher') {
      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('status')
        .eq('id', existingRecord.attendance_session_id)
        .single();

      if (session?.status !== 'draft') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'forbidden',
            message: 'Teachers can only merge records in draft sessions',
          } as MergeAttendanceRecordErrorResponse),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
    }

    // 8. Prepare update data
    const now = new Date().toISOString();
    const updateData: any = {
      status: newStatus,
      record_status: recordStatus,
      merged_at: now,
      merged_by: user.id,
      updated_at: now,
    };

    // Set original_source if recordStatus is overridden and it's currently null
    if (recordStatus === 'overridden' && !existingRecord.original_source) {
      updateData.original_source = existingRecord.source;
    }

    // Add justification if status is excused
    if (newStatus === 'excused' && justification) {
      updateData.justification = justification;
    }

    // Add comment if provided
    if (comment) {
      updateData.comment = comment;
    }

    // Update metadata
    updateData.metadata = {
      ...(existingRecord.metadata || {}),
      manualMerge: true,
      mergedBy: user.id,
      mergedAt: now,
      mergeReason: comment || 'Manual merge by admin',
    };

    // 9. Update the attendance record
    const { data: updatedRecord, error: updateError } = await supabase
      .from('attendance_records')
      .update(updateData)
      .eq('id', attendanceRecordId)
      .select(`
        *,
        student:students(id, first_name, last_name),
        attendance_session:attendance_sessions(id, session_date, session_type)
      `)
      .single();

    if (updateError) {
      console.error('Error updating attendance record:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'update_failed',
          message: 'Failed to update attendance record',
        } as MergeAttendanceRecordErrorResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // 10. Insert audit log
    await supabase.from('audit_logs').insert({
      school_id: existingRecord.school_id,
      user_id: user.id,
      action: 'attendance_record_merged',
      entity_type: 'attendance_record',
      entity_id: attendanceRecordId,
      old_values: {
        status: existingRecord.status,
        record_status: existingRecord.record_status,
        justification: existingRecord.justification,
        comment: existingRecord.comment,
      },
      new_values: {
        status: newStatus,
        record_status: recordStatus,
        justification,
        comment,
      },
      metadata: {
        manualMerge: true,
        mergedBy: user.id,
        userEmail: user.email,
      },
    });

    // 11. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        attendanceRecord: updatedRecord,
      } as MergeAttendanceRecordSuccessResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in merge-attendance-records:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'internal_error',
        message: error.message || 'An unexpected error occurred',
      } as MergeAttendanceRecordErrorResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
