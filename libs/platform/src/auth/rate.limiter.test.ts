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

    it("자리가 차면 가장 오래 쓰이지 않은 열쇠를 밀어낸다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 0.001, maxTrackedKeys: 2 });
        limiter.consume("first", 0);
        limiter.consume("second", 0);
        // first 를 다시 써서 second 가 가장 오래 쓰이지 않은 열쇠가 되게 한다.
        limiter.consume("first", 10);

        limiter.consume("third", 20);

        // 새 열쇠를 넣으면 그때 또 하나가 밀려나므로 남아 있는 열쇠를 먼저 본다.
        expect(limiter.consume("first", 20).allowed).toBe(false);
        // 밀려난 열쇠는 자리를 새로 받아 다시 용량만큼 통과한다.
        expect(limiter.consume("second", 20).allowed).toBe(true);
    });

    it("밀어낸 뒤에도 담는 열쇠 수가 상한을 넘지 않는다", () => {
        const limiter = new TokenBucketLimiter({ capacity: 1, refillPerMs: 0.001, maxTrackedKeys: 2 });

        for (let index = 0; index < 50; index += 1) limiter.consume(`key-${index}`, index);

        // 가장 최근 둘만 남았으므로 그 둘은 소진되어 있고 그보다 앞선 것은 새 자리를 받는다.
        expect(limiter.consume("key-49", 60).allowed).toBe(false);
        expect(limiter.consume("key-0", 60).allowed).toBe(true);
    });
});
