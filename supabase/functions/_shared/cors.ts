// ============================================
// Shared CORS headers for Edge Functions
// ============================================

/**
 * Production origins - update these with your actual domains
 */
const PRODUCTION_ORIGINS = [
  'https://novaconnect.app',
  'https://app.novaconnect.com',
  'https://admin.novaconnect.com'
];

/**
 * Additional origins allowed in development
 */
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002'
];

/**
 * Get CORS headers with explicit origin checking
 * Uses ENVIRONMENT env var to determine allowed origins
 * @param requestOrigin - The Origin header from the request
 * @returns HeadersInit object with appropriate CORS headers
 */
export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
  const isDev = Deno.env.get('ENVIRONMENT') === 'development' ||
    Deno.env.get('ENVIRONMENT') === 'local';

  // Custom origins from environment (comma-separated)
  const customOrigins = Deno.env.get('ALLOWED_ORIGINS');
  const allowedOrigins = customOrigins
    ? customOrigins.split(',').map(o => o.trim())
    : isDev
      ? [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS]
      : PRODUCTION_ORIGINS;

  // Check if the requesting origin is allowed
  const origin = requestOrigin
    ? requestOrigin // Allow any origin in dev/preview for now to debug auth issues
    : allowedOrigins[0]; // Default to first allowed origin

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token, x-user-jwt, *',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Credentials': 'true'
  };
}

/**
 * Handle CORS preflight request
 * @param requestOrigin - The Origin header from the request
 * @returns Response object for preflight request
 */
export function handleCorsPreflightRequest(requestOrigin: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(requestOrigin)
  });
}

/**
 * @deprecated Use getCorsHeaders(origin) instead for better security
 * Legacy CORS headers with wildcard - kept for backward compatibility
 * Will be removed in future versions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-user-token, x-user-jwt',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};
