import { Context, Next } from 'hono';

// Get allowed origins from environment or defaults
const getAllowedOrigins = (): string[] => {
    const envOrigins = process.env.ALLOWED_ORIGINS;
    if (envOrigins) {
        return envOrigins.split(',').map(o => o.trim());
    }
    // Default origins for development
    if (process.env.NODE_ENV === 'development') {
        return [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3002'
        ];
    }
    // Production: require explicit configuration via ALLOWED_ORIGINS env var
    return [];
};

/**
 * CORS middleware with explicit origins
 * Uses ALLOWED_ORIGINS environment variable in production
 * Falls back to common localhost ports in development
 */
export const corsMiddleware = async (c: Context, next: Next) => {
    const origin = c.req.header('Origin') || '';
    const allowedOrigins = getAllowedOrigins();

    // Check if origin is allowed
    const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    if (isAllowed && origin) {
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Credentials', 'true');
    } else if (allowedOrigins.length === 0) {
        // Fallback for when no origins configured (legacy support)
        c.header('Access-Control-Allow-Origin', '*');
    }

    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-School-Id, x-school-id');

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
        return c.text('', 204);
    }

    await next();
    return c.res;
};

/**
 * Security headers middleware
 * Adds standard HTTP security headers to all responses
 */
export const securityHeadersMiddleware = async (c: Context, next: Next) => {
    // Security headers
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    await next();
    return c.res;
};

/**
 * Combined CORS and security middleware
 * Convenience export for using both middlewares together
 */
export const corsAndSecurityMiddleware = async (c: Context, next: Next) => {
    const origin = c.req.header('Origin') || '';
    const allowedOrigins = getAllowedOrigins();

    // Check if origin is allowed
    const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    if (isAllowed && origin) {
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Credentials', 'true');
    } else if (allowedOrigins.length === 0) {
        // Fallback for when no origins configured (legacy support)
        c.header('Access-Control-Allow-Origin', '*');
    }

    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-School-Id, x-school-id');

    // Security headers
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
        return c.text('', 204);
    }

    await next();
    return c.res;
};
