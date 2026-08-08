import { describe, expect, it } from "vitest";
import { zodToClaudeOutputSchema } from "./claude.output.schema.js";
import { boundedText, clampCodePoints, codePointLength } from "./bounded.text.schema.js";
import { z } from "zod";

const THUMBS = "👍";

describe("계약이 세는 글자 수", () => {
    it("이모지 하나를 한 글자로 센다", () => {
        expect(codePointLength(`${THUMBS}${THUMBS}${THUMBS}`)).toBe(3);
    });

    it("UTF-16 길이와 다르다는 것을 고정한다", () => {
        expect(`${THUMBS}${THUMBS}${THUMBS}`.length).toBe(6);
    });

    it("평범한 글자는 그대로 센다", () => {
        expect(codePointLength("한글 abc")).toBe(6);
    });
});

describe("상한을 넘긴 글을 자를 때", () => {
    it("상한 안이면 그대로 낸다", () => {
        expect(clampCodePoints("짧다", 10)).toBe("짧다");
    });

    it("코드포인트 경계에서 잘라 이모지를 쪼개지 않는다", () => {
        const clamped = clampCodePoints(`${THUMBS}${THUMBS}${THUMBS}`, 2);

        expect(clamped).toBe(`${THUMBS}${THUMBS}`);
        expect(codePointLength(clamped)).toBe(2);
    });

    it("자른 값은 같은 상한을 다시 통과한다", () => {
        const clamped = clampCodePoints(`${THUMBS}${THUMBS}${THUMBS}`, 2);

        expect(boundedText(2).safeParse(clamped).success).toBe(true);
    });
});

describe("코드포인트 상한을 갖는 문자열", () => {
    it("이모지 셋을 세 글자 상한으로 받는다", () => {
        expect(boundedText(3).safeParse(`${THUMBS}${THUMBS}${THUMBS}`).success).toBe(true);
    });

    it("상한을 넘긴 글은 거절한다", () => {
        expect(boundedText(2).safeParse(`${THUMBS}${THUMBS}${THUMBS}`).success).toBe(false);
    });

    it("빈 글은 거절한다", () => {
        expect(boundedText(10).safeParse("   ").success).toBe(false);
    });

    it("앞뒤 공백을 걷어 낸 값을 낸다", () => {
        expect(boundedText(10).parse("  답  ")).toBe("답");
    });

    it("모델이 읽도록 상한을 설명에 싣는다", () => {
        const schema = zodToClaudeOutputSchema(z.object({ title: boundedText(80) }));
        const properties = schema["properties"] as Record<string, Record<string, unknown>>;

        expect(properties["title"]?.["description"]).toContain("At most 80 characters.");
    });

    it("자리의 뜻을 적으면 상한 문장을 그 뒤에 잇는다", () => {
        const schema = zodToClaudeOutputSchema(
            z.object({ title: boundedText(80, { describe: "짧은 제목이다." }) }),
        );
        const properties = schema["properties"] as Record<string, Record<string, unknown>>;

        expect(properties["title"]?.["description"]).toBe("짧은 제목이다. At most 80 characters.");
    });
});
