import { describe, expect, it } from "vitest";
import { codePointLength } from "@tracer-agent/llm";
import { clampText } from "./clamp.js";

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u;

describe("상한을 넘긴 글 자르기", () => {
    it("상한 안에 든 글은 그대로 둔다", () => {
        expect(clampText("가나다", 3)).toBe("가나다");
    });

    it("자르는 단위는 계약이 정한 코드포인트다", () => {
        expect(codePointLength(clampText("가".repeat(10), 4))).toBe(4);
    });

    it("기본 다국어 평면 밖의 글자도 한 글자로 세어 자른다", () => {
        const clamped = clampText("🚀".repeat(4), 3);

        expect(codePointLength(clamped)).toBe(3);
        expect(LONE_SURROGATE.test(clamped)).toBe(false);
    });

    it("상한이 0이면 빈 글을 낸다", () => {
        expect(clampText("🚀", 0)).toBe("");
    });
});
