import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { requireExamModeAccess } from '../_shared/examModuleCheck.ts';

interface CalculateExamResultsRequest {
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

    if (!userData || !['school_admin', 'supervisor'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await requireExamModeAccess(supabase, userData.school_id);

    const { deliberationId }: CalculateExamResultsRequest = await req.json();

    // Fetch deliberation with school scoping to prevent cross-tenant access
    const { data: deliberation, error: delibError } = await supabase
      .from('exam_deliberations')
      .select('id, school_id, exam_session_id')
      .eq('id', deliberationId)
      .eq('school_id', userData.school_id)
      .single();

    if (delibError || !deliberation) {
      throw new Error('Deliberation not found or access denied');
    }

    // Call SQL function to calculate results
    const { data: results, error: calcError } = await supabase
      .rpc('calculate_exam_results', {
        p_deliberation_id: deliberationId
      });

    if (calcError) throw calcError;

    // Update deliberation status with school scoping
    await supabase
      .from('exam_deliberations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_students: results.length,
        passed_students: results.filter((r: any) => r.is_passed).length,
        failed_students: results.filter((r: any) => !r.is_passed).length
      })
      .eq('id', deliberationId)
      .eq('school_id', userData.school_id);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: 'Exam results calculated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error calculating exam results:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
