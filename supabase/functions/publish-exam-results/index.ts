import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { requireExamModeAccess } from '../_shared/examModuleCheck.ts';

interface PublishExamResultsRequest {
  deliberationId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) throw new Error('Invalid authorization token');

    const { data: userData } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (!userData || !['school_admin'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await requireExamModeAccess(supabase, userData.school_id);

    const { deliberationId }: PublishExamResultsRequest = await req.json();

    // Verify deliberation is completed
    const { data: deliberation } = await supabase
      .from('exam_deliberations')
      .select('*, exam_sessions(*)')
      .eq('id', deliberationId)
      .eq('school_id', userData.school_id)
      .single();

    if (!deliberation || deliberation.status !== 'completed') {
      throw new Error('Deliberation must be completed before publishing');
    }

    // Update deliberation status
    await supabase
      .from('exam_deliberations')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: user.id
      })
      .eq('id', deliberationId);

    // Get all students with results and map to user_ids
    const { data: results } = await supabase
      .from('exam_results')
      .select('student_id, students(user_id)')
      .eq('deliberation_id', deliberationId);

    // Send notifications to students
    if (results && results.length > 0) {
      const studentNotifications = results
        .filter((r: any) => r.students?.user_id)
        .map((result: any) => ({
          school_id: userData.school_id,
          user_id: result.students.user_id,
          type: 'exam_results_published' as const,
          title: 'Résultats d\'examen publiés',
          body: `Les résultats de ${deliberation.exam_sessions.name} sont disponibles`,
          data: {
            exam_session_id: deliberation.exam_session_id,
            deliberation_id: deliberationId
          }
        }));

      if (studentNotifications.length > 0) {
        await supabase.from('notifications').insert(studentNotifications);
      }

      // Get parent user_ids for all students
      const studentIds = results.map((r: any) => r.student_id);
      const { data: parentRelations } = await supabase
        .from('student_parent_relations')
        .select('parent_id, parents(user_id)')
        .in('student_id', studentIds);

      // Send notifications to parents
      if (parentRelations && parentRelations.length > 0) {
        const parentNotifications = parentRelations
          .filter((pr: any) => pr.parents?.user_id)
          .map((pr: any) => ({
            school_id: userData.school_id,
            user_id: pr.parents.user_id,
            type: 'exam_results_published' as const,
            title: 'Résultats d\'examen de votre enfant publiés',
            body: `Les résultats de ${deliberation.exam_sessions.name} sont disponibles`,
            data: {
              exam_session_id: deliberation.exam_session_id,
              deliberation_id: deliberationId
            }
          }));

        if (parentNotifications.length > 0) {
          await supabase.from('notifications').insert(parentNotifications);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Exam results published successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error publishing exam results:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
