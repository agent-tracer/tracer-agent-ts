import { describe, expect, it } from "vitest";
import { clampCodeUnits } from "./clamp.js";

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u;

describe("상한을 넘긴 글 자르기", () => {
    it("상한 안에 든 글은 그대로 둔다", () => {
        expect(clampCodeUnits("가나다", 3)).toBe("가나다");
    });

    it("자르는 단위는 zod가 세는 UTF-16 코드 유닛이라 잘린 값이 다시 상한을 통과한다", () => {
        const clamped = clampCodeUnits("가".repeat(10), 4);

        expect(clamped).toHaveLength(4);
    });

    it("서로게이트 쌍 가운데를 자르지 않아 짝 없는 서로게이트를 남기지 않는다", () => {
        const clamped = clampCodeUnits("🚀".repeat(4), 5);

        expect(clamped).toHaveLength(4);
        expect(LONE_SURROGATE.test(clamped)).toBe(false);
    });

    it("상한이 0이면 빈 글을 낸다", () => {
        expect(clampCodeUnits("🚀", 0)).toBe("");
    });
});
