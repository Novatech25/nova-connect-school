import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  assignmentId: string;
  notificationType: 'assignment_published' | 'assignment_submitted' | 'assignment_graded' | 'assignment_deadline_soon';
  recipientUserIds?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const payload: NotificationPayload = await req.json();
    const { assignmentId, notificationType, recipientUserIds } = payload;

    // Get assignment details
    const { data: assignment, error: assignmentError } = await supabaseClient
      .from('assignments')
      .select(`
        *,
        class:classes(id, name),
        subject:subjects(id, name),
        teacher:users(id, first_name, last_name, email)
      `)
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      throw new Error('Assignment not found');
    }

    // Get students in the class
    const { data: enrollments } = await supabaseClient
      .from('class_enrollments')
      .select('student_id, students(user_id, first_name, last_name)')
      .eq('class_id', assignment.class_id)
      .eq('status', 'active');

    // Determine recipients based on notification type
    let userIds: string[] = [];
    let title = '';
    let message = '';

    switch (notificationType) {
      case 'assignment_published':
        userIds = enrollments?.map(e => e.students?.user_id).filter(Boolean) || [];
        title = 'Nouveau devoir disponible';
        message = `Un nouveau devoir "${assignment.title}" a été publié pour ${assignment.class.name}`;
        break;

      case 'assignment_deadline_soon':
        userIds = recipientUserIds || [];
        title = 'Rappel : Deadline approche';
        message = `Le devoir "${assignment.title}" est dû bientôt (${new Date(assignment.due_date).toLocaleDateString('fr-FR')})`;
        break;

      case 'assignment_submitted':
        // Notify teacher
        userIds = [assignment.teacher_id];
        title = 'Nouvelle soumission';
        message = `Un élève a soumis le devoir "${assignment.title}"`;
        break;

      case 'assignment_graded':
        // Notify student (passed via recipientUserIds)
        userIds = recipientUserIds || [];
        title = 'Devoir corrigé';
        message = `Votre devoir "${assignment.title}" a été corrigé`;
        break;
    }

    // Create notifications for all recipients
    if (userIds.length > 0) {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        type: notificationType,
        title,
        message,
        data: {
          assignment_id: assignmentId,
          school_id: assignment.school_id,
          class_id: assignment.class_id,
        },
      }));

      const { error: notifyError } = await supabaseClient
        .from('notifications')
        .insert(notifications);

      if (notifyError) {
        console.error('Failed to create notifications:', notifyError);
        throw notifyError;
      }

      // Optional: Send push notifications (requires additional setup)
      // await sendPushNotifications(userIds, title, message);
    }

    return new Response(
      JSON.stringify({ success: true, notifiedCount: userIds.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending assignment notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
