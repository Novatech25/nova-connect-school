import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface RevokeStudentCardRequest {
  cardId: string;
  reason: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Verify user has permission (school_admin only)
    const { data: userData } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'school_admin') {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized: School admin only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cardId, reason }: RevokeStudentCardRequest = await req.json();

    if (!reason || reason.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Reason is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch card
    const { data: card, error: cardError } = await supabase
      .from('student_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return new Response(
        JSON.stringify({ success: false, message: 'Card not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if card belongs to user's school
    if (card.school_id !== userData.school_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized: Card not from your school' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if card is already revoked
    if (card.status === 'revoked') {
      return new Response(
        JSON.stringify({ success: false, message: 'Card is already revoked' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Revoke card
    const { data: updatedCard, error: updateError } = await supabase
      .from('student_cards')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revocation_reason: reason,
      })
      .eq('id', cardId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Optionally, you could send a notification to the student/parent here
    // For example, using the send-notification Edge Function
    // await supabase.functions.invoke('send-notification', {
    //   body: {
    //     type: 'card_revoked',
    //     studentId: card.student_id,
    //     data: {
    //       cardNumber: card.card_number,
    //       reason,
    //     },
    //   },
    // });

    return new Response(
      JSON.stringify({
        success: true,
        card: updatedCard,
        message: 'Card revoked successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error revoking student card:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
