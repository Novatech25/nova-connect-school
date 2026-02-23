import { Context, Next } from 'hono';
import { rateLimiter, strictRateLimiter, RateLimitService } from '../services/rate-limit.js';

// Helper to get client IP
const getClientIp = (c: Context): string => {
    return c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown-ip';
};

// Rate Limit Middleware Factory
export const rateLimitMiddleware = (limiter: RateLimitService = rateLimiter) => {
    return async (c: Context, next: Next) => {
        // Skip rate limiting in development if needed
        // if (process.env.NODE_ENV === 'development') return next();

        const ip = getClientIp(c);
        const user = c.get('user');

        // Key hierarchy: User ID > IP
        const key = user?.id ? `user:${user.id}` : `ip:${ip}`;

        const result = limiter.check(key);

        // Set standard RateLimit headers
        c.header('X-RateLimit-Limit', result.limit.toString());
        c.header('X-RateLimit-Remaining', result.remaining.toString());
        c.header('X-RateLimit-Reset', Math.ceil(result.reset / 1000).toString());

        if (!result.success) {
            return c.json({
                error: 'Too Many Requests',
                message: 'Please try again later',
                retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
            }, 429);
        }

        await next();
    };
};

export const defaultRateLimit = rateLimitMiddleware(rateLimiter);
export const strictRateLimit = rateLimitMiddleware(strictRateLimiter);
