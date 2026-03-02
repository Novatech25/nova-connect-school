import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { messageId, conversationId, senderId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer infos message et conversation
    const { data: message } = await supabaseClient
      .from('chat_messages')
      .select('content')
      .eq('id', messageId)
      .single();

    const { data: conversation } = await supabaseClient
      .from('chat_conversations')
      .select('school_id, title, conversation_type')
      .eq('id', conversationId)
      .single();

    const { data: sender } = await supabaseClient
      .from('users')
      .select('first_name, last_name')
      .eq('id', senderId)
      .single();

    // Récupérer participants (sauf expéditeur)
    const { data: participants } = await supabaseClient
      .from('chat_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('is_blocked', false)
      .neq('user_id', senderId);

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recipients' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Créer notifications pour chaque participant
    const notifications = participants.map(p => ({
      school_id: conversation.school_id,
      user_id: p.user_id,
      type: 'chat_message_received',
      title: `Nouveau message de ${sender.first_name} ${sender.last_name}`,
      body: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      data: {
        conversation_id: conversationId,
        message_id: messageId,
        sender_id: senderId,
      },
      priority: 'normal',
      channels: ['in_app', 'push'],
    }));

    const { error } = await supabaseClient
      .from('notifications')
      .insert(notifications);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, notificationsSent: notifications.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending chat notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
