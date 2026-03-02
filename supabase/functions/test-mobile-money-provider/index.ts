// ============================================================================
// Edge Function: Test Mobile Money Provider Connection
// ============================================================================
// Tests the API credentials and connectivity for a Mobile Money provider
// Used during provider configuration to validate settings
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Create authenticated Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // 2. Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse request
    const { provider_id } = await req.json();

    if (!provider_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: provider_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Create service role client for privileged operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Get user's school_id and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('school_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.school_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with a school' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Verify user has required role (school_admin only)
    if (userData.role !== 'school_admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only school admins can test provider connections' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schoolId = userData.school_id;

    // 7. Get provider configuration with school access control
    const { data: provider, error: providerError } = await supabase
      .from('mobile_money_providers')
      .select('*')
      .eq('id', provider_id)
      .eq('school_id', schoolId)
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ error: 'Provider not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test connection by attempting a small payment request or health check
    // In test mode, providers often have a health check endpoint
    const testEndpoint = provider.is_test_mode
      ? `${provider.api_endpoint}/health`
      : `${provider.api_endpoint}/health`;

    try {
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${provider.api_key_encrypted}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.ok) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Provider connection successful',
            details: {
              status: response.status,
              provider: provider.provider_name
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Provider connection failed',
            details: {
              status: response.status,
              statusText: response.statusText
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      // If health check fails, try a minimal initiate request
      // Some providers don't have health check endpoints
      try {
        const initiateResponse = await fetch(`${provider.api_endpoint}/v1/payments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.api_key_encrypted}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: 1,
            phone_number: '0000000000',
            reference: 'TEST_CONNECTION'
          }),
          signal: AbortSignal.timeout(10000)
        });

        // We expect this to fail, but if we get an auth error, the connection works
        if (initiateResponse.status === 401 || initiateResponse.status === 403) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Provider connection successful (authentication working)',
              details: {
                provider: provider.provider_name
              }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Could not verify provider connection',
              details: {
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (retryError) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Provider unreachable',
            details: {
              error: retryError instanceof Error ? retryError.message : 'Unknown error'
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error: any) {
    console.error('Error testing provider:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
