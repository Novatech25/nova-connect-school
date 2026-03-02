import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkPremiumFeature } from "../_shared/premiumCheck.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  // Gérer CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req.headers.get('origin'));
  }

  try {
    const rawAuthHeader =
      req.headers.get('x-user-token') ||
      req.headers.get('x-user-jwt') ||
      req.headers.get('Authorization') ||
      '';

    if (!rawAuthHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      );
    }

    const token = rawAuthHeader.startsWith('Bearer ')
      ? rawAuthHeader.replace('Bearer ', '')
      : rawAuthHeader;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      );
    }

    const { conversationId, content, senderId } = await req.json();

    // Verify sender matches authenticated user
    if (senderId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized sender' }),
        { status: 403, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer school_id depuis conversation
    const { data: conversation, error: convError } = await supabaseClient
      .from('chat_conversations')
      .select('school_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier accès premium au module chat
    const hasAccess = await checkPremiumFeature(
      supabaseClient,
      conversation.school_id,
      'chat_moderation'
    );

    if (!hasAccess) {
      // Si l'école n'a pas l'option de modération payante, on laisse passer le message normalement sans modération
      return new Response(
        JSON.stringify({
          valid: true,
          moderationRequired: false
        }),
        { status: 200, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer règles de modération actives
    const { data: rules } = await supabaseClient
      .from('chat_moderation_rules')
      .select('*')
      .eq('school_id', conversation.school_id)
      .eq('is_active', true);

    let moderationRequired = false;
    let flaggedReasons: string[] = [];

    // Vérifier mots interdits
    const forbiddenWords = rules?.filter(r => r.rule_type === 'forbidden_word') || [];
    for (const rule of forbiddenWords) {
      const regex = new RegExp(`\\b${rule.rule_value}\\b`, 'gi');
      if (regex.test(content)) {
        moderationRequired = true;
        flaggedReasons.push(`Forbidden word detected: ${rule.rule_value}`);

        if (rule.action === 'block') {
          return new Response(
            JSON.stringify({
              error: 'Message contains forbidden content',
              blocked: true
            }),
            { status: 400, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Vérifier patterns regex
    const regexRules = rules?.filter(r => r.rule_type === 'regex_pattern') || [];
    for (const rule of regexRules) {
      try {
        const regex = new RegExp(rule.rule_value, 'gi');
        if (regex.test(content)) {
          moderationRequired = true;
          flaggedReasons.push(`Pattern matched: ${rule.rule_value}`);
        }
      } catch (e) {
        console.error('Invalid regex pattern:', rule.rule_value);
      }
    }

    // Vérifier longueur max
    const lengthRules = rules?.filter(r => r.rule_type === 'max_message_length') || [];
    for (const rule of lengthRules) {
      const maxLength = parseInt(rule.rule_value);
      if (content.length > maxLength) {
        moderationRequired = true;
        flaggedReasons.push(`Message too long: ${content.length} > ${maxLength}`);
      }
    }

    // Logger si modération requise
    if (moderationRequired) {
      await supabaseClient
        .from('chat_moderation_logs')
        .insert({
          school_id: conversation.school_id,
          conversation_id: conversationId,
          user_id: senderId,
          action: 'flagged',
          reason: flaggedReasons.join('; '),
          flagged_content: content.substring(0, 500),
          auto_moderated: true,
        });
    }

    return new Response(
      JSON.stringify({
        valid: true,
        moderationRequired,
        flaggedReasons: moderationRequired ? flaggedReasons : undefined
      }),
      { status: 200, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
