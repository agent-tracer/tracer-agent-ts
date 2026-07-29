import { describe, expect, it } from "vitest";
import { TokenBucketLimiter } from "./rate.limiter.js";

describe("TokenBucketLimiter", () => {
    it("용량만큼은 곧바로 통과시킨다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 2, refillPerMs: 0.001 });

        expect(limiter.consume("local", 0).allowed).toBe(true);
        expect(limiter.consume("local", 0).allowed).toBe(true);
        expect(limiter.consume("local", 0).allowed).toBe(false);
    });

    it("거절하면 다시 시도할 시간을 알린다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 0.001 });
        limiter.consume("local", 0);

        expect(limiter.consume("local", 0).retryAfterMs).toBe(1000);
    });

    it("시간이 지나면 토큰을 다시 채운다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 0.001 });
        limiter.consume("local", 0);

        expect(limiter.consume("local", 1000).allowed).toBe(true);
    });

    it("사용자마다 따로 센다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 0.001 });
        limiter.consume("local", 0);

        expect(limiter.consume("other", 0).allowed).toBe(true);
    });
});
