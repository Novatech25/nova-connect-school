/**
 * Simple In-Memory Rate Limiter for Next.js Middleware
 * 
 * Note: In a serverless/edge environment (like Vercel), this memory is not shared 
 * across all instances, so it acts as a "per-instance" rate limiter.
 * For a distributed rate limiter, use Upstash Redis or similar.
 */

interface RateLimitConfig {
    uniqueTokenPerInterval?: number; // Max number of unique users tracked per interval
    interval?: number; // Interval in ms
    limit?: number; // Max requests per interval
}

export class RateLimit {
    private tokenCache: Map<string, number[]>;
    private config: Required<RateLimitConfig>;

    constructor(config: RateLimitConfig = {}) {
        this.tokenCache = new Map();
        this.config = {
            uniqueTokenPerInterval: config.uniqueTokenPerInterval || 500,
            interval: config.interval || 60000, // 1 minute
            limit: config.limit || 10, // 10 requests per minute
        };
    }

    check(limit: number, token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const now = Date.now();
            const windowStart = now - this.config.interval;

            const timestamp = this.tokenCache.get(token) || [];

            // Filter out old timestamps
            const windowTimestamps = timestamp.filter((ts) => ts > windowStart);

            // Add current request
            windowTimestamps.push(now);

            this.tokenCache.set(token, windowTimestamps);

            if (windowTimestamps.length > limit) {
                reject(new Error('Rate limit exceeded'));
            } else {
                // Cleanup old entries if map gets too big
                if (this.tokenCache.size > this.config.uniqueTokenPerInterval) {
                    // Naive cleanup: remove first 20% of entries
                    const keysToDelete = Array.from(this.tokenCache.keys()).slice(0, Math.floor(this.tokenCache.size * 0.2));
                    keysToDelete.forEach(k => this.tokenCache.delete(k));
                }
                resolve();
            }
        });
    }
}

// Global instance for general API protection (100 req/min)
export const globalRateLimiter = new RateLimit({
    interval: 60 * 1000, // 1 minute
    limit: 100
});

// Stricter limiter for sensitive auth routes (10 req/min)
export const authRateLimiter = new RateLimit({
    interval: 60 * 1000,
    limit: 10
});
