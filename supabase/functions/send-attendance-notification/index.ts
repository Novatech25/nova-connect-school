// Edge Function: Send Attendance Notifications
// Description: Sends notifications to parents when their children are marked absent or late
// Trigger: Called by SQL trigger or manually via API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttendanceNotificationRequest {
  studentId: string;
  attendanceRecordId: string;
  status: 'absent' | 'late';
  sessionId: string;
  sessionDate: string;
}

interface NotificationResult {
  parentId: string;
  success: boolean;
  channels: string[];
  errors?: string[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { studentId, attendanceRecordId, status, sessionId, sessionDate } =
      await req.json() as AttendanceNotificationRequest;

    // Validate input
    if (!studentId || !attendanceRecordId || !status || !sessionId || !sessionDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process absences and lates
    if (!['absent', 'late'].includes(status)) {
      return new Response(
        JSON.stringify({ message: 'Status does not require notification' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing attendance notification for student ${studentId}, status: ${status}`);

    // Fetch student information
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, school_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      throw new Error(`Failed to fetch student: ${studentError?.message}`);
    }

    // Fetch session information
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        id,
        session_date,
        planned_session:planned_sessions(subject_name, start_time, end_time)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Failed to fetch session: ${sessionError?.message}`);
    }

    // Fetch parents with their notification preferences
    const { data: parentRelations, error: parentsError } = await supabase
      .from('student_parent_relations')
      .select(`
        parent_id,
        parent:users!student_parent_relations_parent_id_fkey(
          id, 
          first_name, 
          email,
          notification_preferences
        )
      `)
      .eq('student_id', studentId);

    if (parentsError) {
      throw new Error(`Failed to fetch parents: ${parentsError.message}`);
    }

    if (!parentRelations || parentRelations.length === 0) {
      console.log(`No parents found for student ${studentId}`);
      return new Response(
        JSON.stringify({ message: 'No parents to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build notification message
    const studentName = `${student.first_name} ${student.last_name}`;
    const dateFormatted = new Date(sessionDate).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const subjectName = (session.planned_session as any)?.subject_name || 'cours';
    const timeRange = (session.planned_session as any)
      ? `${(session.planned_session as any).start_time} - ${(session.planned_session as any).end_time}`
      : '';

    let notificationTitle: string;
    let notificationBody: string;

    if (status === 'absent') {
      notificationTitle = `Absence de ${student.first_name}`;
      notificationBody = `Votre enfant ${studentName} a été marqué(e) absent(e) le ${dateFormatted}${
        timeRange ? ` (${timeRange})` : ''
      } pour ${subjectName}.`;
    } else {
      notificationTitle = `Retard de ${student.first_name}`;
      notificationBody = `Votre enfant ${studentName} a été marqué(e) en retard le ${dateFormatted}${
        timeRange ? ` (${timeRange})` : ''
      } pour ${subjectName}.`;
    }

    // Send notifications to each parent
    const notificationPromises = parentRelations.map(async (relation: any) => {
      const parent = relation.parent;
      const results: NotificationResult = {
        parentId: parent?.id,
        success: true,
        channels: [],
        errors: [],
      };

      if (!parent || !parent.id) {
        console.log('Invalid parent data, skipping');
        return { ...results, success: false, errors: ['Invalid parent data'] };
      }

      // Get notification preferences
      const preferences = parent.notification_preferences || {
        attendance_marked: {
          in_app: true,
          push: true,
          email: false,
          sms: false,
        }
      };

      const typePrefs = preferences.attendance_marked || { in_app: true, push: true };

      try {
        // 1. In-app notification (already created by SQL trigger)
        if (typePrefs.in_app) {
          results.channels.push('in_app');
        }

        // 2. Push notification
        if (typePrefs.push) {
          try {
            // Fetch Expo push tokens from push_tokens table
            const { data: tokens, error: tokensError } = await supabase
              .from('push_tokens')
              .select('token')
              .eq('user_id', parent.id)
              .eq('is_active', true);

            if (tokensError) {
              console.error(`Error fetching push tokens for parent ${parent.id}:`, tokensError);
              results.errors?.push(`Push token error: ${tokensError.message}`);
            } else if (tokens && tokens.length > 0) {
              // Send push notification via Expo
              const expoMessages = tokens.map((tokenRecord: any) => ({
                to: tokenRecord.token,
                sound: 'default',
                title: notificationTitle,
                body: notificationBody,
                data: {
                  type: 'attendance_marked',
                  studentId,
                  attendanceRecordId,
                  status,
                  sessionId,
                  sessionDate,
                },
                priority: 'high',
              }));

              const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Accept-Encoding': 'gzip, deflate',
                },
                body: JSON.stringify(expoMessages),
              });

              if (expoResponse.ok) {
                const expoResult = await expoResponse.json();
                console.log(`Push sent to parent ${parent.id}:`, expoResult);
                results.channels.push('push');

                // Log the push notification
                await supabase.from('notification_logs').insert({
                  user_id: parent.id,
                  school_id: student.school_id,
                  type: 'attendance_marked',
                  channel: 'push',
                  status: 'sent',
                  data: {
                    studentId,
                    attendanceRecordId,
                    status,
                    expoResponse: expoResult,
                  },
                  sent_at: new Date().toISOString(),
                });
              } else {
                const errorText = await expoResponse.text();
                console.error(`Failed to send Expo push to parent ${parent.id}:`, errorText);
                results.errors?.push(`Push failed: ${errorText}`);
              }
            } else {
              console.log(`No active push tokens for parent ${parent.id}`);
            }
          } catch (error) {
            console.error(`Error sending push to parent ${parent.id}:`, error);
            results.errors?.push(`Push error: ${error.message}`);
          }
        }

        // 3. Email notification
        if (typePrefs.email && parent.email) {
          try {
            const emailResponse = await fetch(
              `${supabaseUrl}/functions/v1/send-email-notification`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  to: parent.email,
                  subject: notificationTitle,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #333;">${notificationTitle}</h2>
                      <p>Bonjour ${parent.first_name || ''},</p>
                      <p>${notificationBody}</p>
                      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                      <p style="color: #666; font-size: 12px;">
                        Cette notification a été envoyée automatiquement par NovaConnect.
                      </p>
                    </div>
                  `,
                }),
              }
            );

            if (emailResponse.ok) {
              results.channels.push('email');
              await supabase.from('notification_logs').insert({
                user_id: parent.id,
                school_id: student.school_id,
                type: 'attendance_marked',
                channel: 'email',
                status: 'sent',
                sent_at: new Date().toISOString(),
              });
            } else {
              const errorText = await emailResponse.text();
              results.errors?.push(`Email failed: ${errorText}`);
            }
          } catch (error) {
            results.errors?.push(`Email error: ${error.message}`);
          }
        }

        // 4. SMS notification
        if (typePrefs.sms) {
          // TODO: Implement SMS via Twilio or similar service
          console.log(`SMS notification requested for parent ${parent.id} but not implemented`);
        }

      } catch (error) {
        console.error(`Error processing notification for parent ${parent.id}:`, error);
        results.success = false;
        results.errors?.push(error.message);
      }

      return results;
    });

    const notificationResults = await Promise.all(notificationPromises);

    // Summary log
    const successCount = notificationResults.filter(r => r.success && r.channels.length > 0).length;
    const errorCount = notificationResults.filter(r => r.errors && r.errors.length > 0).length;

    console.log(`Attendance notification completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent to ${parentRelations.length} parent(s)`,
        results: notificationResults,
        summary: {
          totalParents: parentRelations.length,
          successful: successCount,
          errors: errorCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in attendance notification function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
