
interface TokenBucket {
    tokens: number;
    lastRefill: number;
}

export class RateLimitService {
    private buckets: Map<string, TokenBucket>;
    private readonly capacity: number;
    private readonly refillRate: number; // tokens per second
    private readonly window: number; // window size in milliseconds

    constructor(capacity: number = 60, refillRate: number = 1) {
        this.buckets = new Map();
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.window = 1000;

        // Cleanup old buckets periodically (every 5 minutes)
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    check(key: string, cost: number = 1): { success: boolean; limit: number; remaining: number; reset: number } {
        const now = Date.now();
        let bucket = this.buckets.get(key);

        if (!bucket) {
            bucket = {
                tokens: this.capacity,
                lastRefill: now,
            };
            this.buckets.set(key, bucket);
        }

        // Refill tokens based on time passed
        const timePassed = (now - bucket.lastRefill) / 1000;
        const tokensToAdd = timePassed * this.refillRate;

        bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;

        const success = bucket.tokens >= cost;
        if (success) {
            bucket.tokens -= cost;
        }

        // Calculate reset time (time to full refill)
        const tokensNeeded = this.capacity - bucket.tokens;
        const timeToFull = (tokensNeeded / this.refillRate) * 1000;

        return {
            success,
            limit: this.capacity,
            remaining: Math.floor(bucket.tokens),
            reset: now + timeToFull,
        };
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, bucket] of this.buckets.entries()) {
            // Remove buckets that are full (user hasn't been active) for more than 1 hour
            if (bucket.tokens >= this.capacity && (now - bucket.lastRefill > 3600000)) {
                this.buckets.delete(key);
            }
        }
    }
}

// Global instance with default settings: 100 requests per minute
// capacity = 100, refillRate = 100/60 = 1.66 tokens/sec
export const rateLimiter = new RateLimitService(100, 100 / 60);

// Strict limiter for sensitive endpoints (login, etc): 10 requests per minute
export const strictRateLimiter = new RateLimitService(10, 10 / 60);
