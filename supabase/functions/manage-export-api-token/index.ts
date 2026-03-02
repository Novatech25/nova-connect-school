// ============================================
// Module Premium - API Export Avancé
// Edge Function: Manage Export API Tokens
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bcrypt } from 'https://deno.land/x/bcrypt/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header required');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Invalid authentication');

    const { action, tokenId, ...data } = await req.json();

    const schoolId = await getUserExportSchoolId(supabaseClient, user.id);
    if (!schoolId) throw new Error('User not associated with any school');

    switch (action) {
      case 'create':
        return await createToken(supabaseClient, schoolId, user.id, data);

      case 'list':
        return await listTokens(supabaseClient, schoolId);

      case 'revoke':
        return await revokeToken(supabaseClient, schoolId, user.id, tokenId);

      case 'validate':
        return await validateToken(supabaseClient, schoolId, tokenId);

      default:
        throw new Error('Invalid action');
    }

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: error.message.includes('permission') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function createToken(supabaseClient: any, schoolId: string, userId: string, data: any) {
  const { name, description, permissions, rateLimitPerHour = 100, expiresAt } = data;

  if (!name || !permissions || !Array.isArray(permissions)) {
    throw new Error('name and permissions (array) are required');
  }

  // Generate secure token
  const token = `nova_export_${crypto.randomUUID()}`;
  const tokenHash = await bcrypt.hash(token);

  const { data: tokenData, error } = await supabaseClient
    .from('export_api_tokens')
    .insert({
      school_id: schoolId,
      token_hash: tokenHash,
      name,
      description,
      permissions,
      rate_limit_per_hour: rateLimitPerHour,
      expires_at: expiresAt || null,
      created_by: userId
    })
    .select()
    .single();

  if (error) throw new Error('Failed to create token');

  return new Response(
    JSON.stringify({
      success: true,
      token,
      tokenId: tokenData.id,
      warning: 'Copy this token now. It will not be shown again.'
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listTokens(supabaseClient: any, schoolId: string) {
  const { data: tokens, error } = await supabaseClient
    .from('export_api_tokens')
    .select('id, name, description, permissions, created_at, expires_at, last_used_at, usage_count, rate_limit_per_hour, revoked_at')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Failed to list tokens');

  // Mask tokens
  const maskedTokens = tokens?.map(t => ({
    ...t,
    token_preview: 'nova_export_****...****'
  })) || [];

  return new Response(
    JSON.stringify({ success: true, tokens: maskedTokens }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function revokeToken(supabaseClient: any, schoolId: string, userId: string, tokenId: string) {
  if (!tokenId) throw new Error('tokenId is required');

  const { error } = await supabaseClient
    .from('export_api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('school_id', schoolId);

  if (error) throw new Error('Failed to revoke token');

  return new Response(
    JSON.stringify({ success: true, message: 'Token revoked successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function validateToken(supabaseClient: any, schoolId: string, tokenId: string) {
  if (!tokenId) throw new Error('tokenId is required');

  const { data: token, error } = await supabaseClient
    .from('export_api_tokens')
    .select('*')
    .eq('id', tokenId)
    .eq('school_id', schoolId)
    .single();

  if (error || !token) throw new Error('Token not found');

  const isValid = !token.revoked_at && (!token.expires_at || new Date(token.expires_at) > new Date());

  return new Response(
    JSON.stringify({
      success: true,
      valid: isValid,
      token: {
        name: token.name,
        permissions: token.permissions,
        expires_at: token.expires_at,
        last_used_at: token.last_used_at,
        usage_count: token.usage_count
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getUserExportSchoolId(supabaseClient: any, userId: string): Promise<string | null> {
  const { data: adminData } = await supabaseClient
    .from('school_admins')
    .select('school_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (adminData) return adminData.school_id;
  return null;
}
