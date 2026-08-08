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

    consume(key: string, now: number): RateLimitResult {
        const bucket = this.touch(key, now);
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

    /** 건드린 열쇠를 Map 의 끝으로 옮겨 담는 차례가 곧 마지막으로 쓴 차례가 되게 한다. */
    private touch(key: string, now: number): Bucket {
        const existing = this.buckets.get(key);
        if (existing === undefined) return this.createBucket(key, now);
        this.buckets.delete(key);
        this.buckets.set(key, existing);
        return existing;
    }

    private createBucket(key: string, now: number): Bucket {
        if (this.buckets.size >= this.maxTrackedKeys) this.evictOldest();
        const bucket: Bucket = { tokens: this.capacity, lastRefillAt: now };
        this.buckets.set(key, bucket);
        return bucket;
    }

    /** 담는 차례가 마지막으로 쓴 차례이므로 맨 앞 하나가 가장 오래 쓰이지 않은 열쇠다. */
    private evictOldest(): void {
        const oldestKey = this.buckets.keys().next().value;
        if (oldestKey !== undefined) this.buckets.delete(oldestKey);
    }
}
