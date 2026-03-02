import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get assignments due in the next 24-48 hours
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: assignments, error: assignmentsError } = await supabaseClient
      .from('assignments')
      .select(`
        id,
        title,
        due_date,
        class_id,
        school_id
      `)
      .eq('status', 'published')
      .gte('due_date', tomorrow.toISOString())
      .lte('due_date', dayAfterTomorrow.toISOString());

    if (assignmentsError) {
      throw assignmentsError;
    }

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No deadlines approaching', checkedCount: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let totalNotified = 0;

    // For each assignment, find students who haven't submitted yet
    for (const assignment of assignments) {
      // Get all enrolled students
      const { data: enrollments } = await supabaseClient
        .from('class_enrollments')
        .select('student_id, students(user_id)')
        .eq('class_id', assignment.class_id)
        .eq('status', 'active');

      if (!enrollments) continue;

      // Get students who have submitted
      const { data: submissions } = await supabaseClient
        .from('assignment_submissions')
        .select('student_id')
        .eq('assignment_id', assignment.id)
        .in('status', ['submitted', 'graded', 'returned']);

      const submittedStudentIds = new Set(submissions?.map(s => s.student_id) || []);

      // Find students who haven't submitted
      const pendingStudents = enrollments.filter(
        e => !submittedStudentIds.has(e.student_id)
      );

      // Send notifications to pending students
      if (pendingStudents.length > 0) {
        const notifications = pendingStudents.map(student => ({
          user_id: student.students.user_id,
          type: 'assignment_deadline_soon',
          title: 'Rappel : Deadline approche',
          message: `Le devoir "${assignment.title}" est dû bientôt (${new Date(assignment.due_date).toLocaleDateString('fr-FR')}). N'oubliez pas de le soumettre.`,
          data: {
            assignment_id: assignment.id,
            school_id: assignment.school_id,
            class_id: assignment.class_id,
          },
        }));

        const { error: notifyError } = await supabaseClient
          .from('notifications')
          .insert(notifications);

        if (!notifyError) {
          totalNotified += notifications.length;
        } else {
          console.error(`Failed to notify for assignment ${assignment.id}:`, notifyError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${totalNotified} deadline reminders`,
        checkedCount: assignments.length,
        notifiedCount: totalNotified,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error checking assignment deadlines:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
