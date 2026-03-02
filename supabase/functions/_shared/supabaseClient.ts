// ============================================
// Supabase Client Helper for Edge Functions
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Create service role client (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create anon client (respects RLS)
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Create authenticated client for a specific user
 * @param accessToken - User's JWT access token
 * @returns Supabase client with user context
 */
export function createAuthenticatedClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

/**
 * Verify JWT token and return user ID
 * @param authHeader - Authorization header value
 * @returns User ID or null
 */
export async function verifyAuthHeader(authHeader: string): Promise<string | null> {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Error verifying auth header:', error);
    return null;
  }
}

export default {
  supabase,
  supabaseAnon,
  createAuthenticatedClient,
  verifyAuthHeader
};
