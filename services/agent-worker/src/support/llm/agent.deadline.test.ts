import { describe, expect, it } from "vitest";
import { deadlineFractionMs, weightedWallClockMs } from "./agent.deadline.js";

describe("단계 벽시계 상한", () => {
    it("실행 데드라인의 비율만큼을 상한으로 낸다", () => {
        expect(deadlineFractionMs(10_000, 0.3)).toBe(3000);
    });

    it("몫이 큰 워커가 더 긴 상한을 받는다", () => {
        const big = weightedWallClockMs(1000, 0.8, 1.0);
        const small = weightedWallClockMs(1000, 0.1, 1.0);

        expect(big).toBeGreaterThan(small);
    });

    it("몫이 아주 작아도 최소 비율만큼은 준다", () => {
        expect(weightedWallClockMs(1000, 0.01, 1.0)).toBe(300);
    });

    it("몫이 예산 전부여도 상한을 넘기지 않는다", () => {
        expect(weightedWallClockMs(1000, 2.0, 1.0)).toBe(1000);
    });

    it("예산을 모르는 실행은 상한 전체를 쓴다", () => {
        expect(weightedWallClockMs(1000, undefined, 1.0)).toBe(1000);
        expect(weightedWallClockMs(1000, 0.5, undefined)).toBe(1000);
        expect(weightedWallClockMs(1000, 0.5, 0)).toBe(1000);
    });
});
