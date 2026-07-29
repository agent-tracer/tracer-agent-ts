/** retryAfterMs는 429 응답의 Retry-After 헤더에 실을 대기 시간이다. */
export interface RateLimitResult {
    readonly allowed: boolean;
    readonly retryAfterMs: number;
}

export interface TokenBucketOptions {
    readonly capacity: number;
    readonly refillPerMs: number;
    readonly maxTrackedKeys?: number;
}

interface Bucket {
    tokens: number;
    lastRefillAt: number;
}

const DEFAULT_MAX_TRACKED_KEYS = 10_000;

export class TokenBucketLimiter {
    private readonly buckets = new Map<string, Bucket>();
    private readonly capacity: number;
    private readonly refillPerMs: number;
    private readonly maxTrackedKeys: number;

    constructor(options: TokenBucketOptions) {
        this.capacity = options.capacity;
        this.refillPerMs = options.refillPerMs;
        this.maxTrackedKeys = options.maxTrackedKeys ?? DEFAULT_MAX_TRACKED_KEYS;
    }

    consume(key: string, now: number = Date.now()): RateLimitResult {
        const bucket = this.buckets.get(key) ?? this.createBucket(key, now);
        const elapsedMs = Math.max(0, now - bucket.lastRefillAt);
        bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedMs * this.refillPerMs);
        bucket.lastRefillAt = now;

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return { allowed: true, retryAfterMs: 0 };
        }
        const deficitTokens = 1 - bucket.tokens;
        return { allowed: false, retryAfterMs: Math.ceil(deficitTokens / this.refillPerMs) };
    }

    private createBucket(key: string, now: number): Bucket {
        if (this.buckets.size >= this.maxTrackedKeys) this.evictOldest();
        const bucket: Bucket = { tokens: this.capacity, lastRefillAt: now };
        this.buckets.set(key, bucket);
        return bucket;
    }

    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestAt = Infinity;
        for (const [key, bucket] of this.buckets) {
            if (bucket.lastRefillAt < oldestAt) {
                oldestAt = bucket.lastRefillAt;
                oldestKey = key;
            }
        }
        if (oldestKey !== null) this.buckets.delete(oldestKey);
    }
}
