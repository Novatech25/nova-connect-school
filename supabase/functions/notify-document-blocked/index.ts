import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { studentId, documentType } = await req.json();

    // Get student and parents
    const { data: student } = await supabase
      .from('students')
      .select('*, school:schools(*)')
      .eq('id', studentId)
      .single();

    const { data: parents } = await supabase
      .from('student_parent_relations')
      .select('parent:parents(*)')
      .eq('student_id', studentId);

    if (!student || !parents) {
      throw new Error('Student or parents not found');
    }

    // Create notification for each parent
    const notifications = parents.map((rel: any) => ({
      school_id: student.school_id,
      user_id: rel.parent.id,
      type: 'document_blocked',
      title: 'Accès document bloqué',
      message: `L'accès au document (${documentType}) de ${student.first_name} ${student.last_name} est bloqué en raison d'arriérés de paiement.`,
      metadata: {
        student_id: studentId,
        document_type: documentType,
      },
    }));

    await supabase.from('notifications').insert(notifications);

    // TODO: Send push notifications via Expo
    // TODO: Send email/SMS if configured

    return new Response(
      JSON.stringify({ success: true, notificationsSent: notifications.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending notifications:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
