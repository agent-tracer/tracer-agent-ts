import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodToClaudeOutputSchema } from "./claude.output.schema.js";

function propertyOf(schema: Record<string, unknown>, name: string): Record<string, unknown> {
    const properties = schema["properties"] as Record<string, Record<string, unknown> | undefined>;
    const property = properties[name];
    if (property === undefined) throw new Error(`스키마에 ${name} 칸이 없다`);
    return property;
}

describe("모델이 보는 구조화 출력 스키마", () => {
    it("배열 개수 상한을 스키마에서 빼고 설명으로 옮긴다", () => {
        const schema = zodToClaudeOutputSchema(z.object({ probes: z.array(z.string()).max(3) }));

        const probes = propertyOf(schema, "probes");
        expect(probes["maxItems"]).toBeUndefined();
        expect(probes["description"]).toBe("At most 3 items.");
    });

    it("문자 길이 상한을 스키마에서 빼고 설명으로 옮긴다", () => {
        const schema = zodToClaudeOutputSchema(z.object({ title: z.string().max(120) }));

        const title = propertyOf(schema, "title");
        expect(title["maxLength"]).toBeUndefined();
        expect(title["description"]).toBe("At most 120 characters.");
    });

    it("이미 있는 설명을 지우지 않고 그 뒤에 상한을 잇는다", () => {
        const schema = zodToClaudeOutputSchema(
            z.object({ intent: z.string().max(200).describe("무엇을 하려는 작업인가.") }),
        );

        expect(propertyOf(schema, "intent")["description"]).toBe("무엇을 하려는 작업인가. At most 200 characters.");
    });

    it("제약이 여럿이면 선언한 차례대로 한 문장씩 잇는다", () => {
        const schema = zodToClaudeOutputSchema(z.object({ summary: z.string().min(10).max(4000) }));

        expect(propertyOf(schema, "summary")["description"]).toBe("At least 10 characters. At most 4000 characters.");
    });

    it("배열 요소 안의 상한도 그 요소의 설명으로 옮긴다", () => {
        const schema = zodToClaudeOutputSchema(
            z.object({ excerpts: z.array(z.object({ reason: z.string().max(400) })).max(12) }),
        );

        const excerpts = propertyOf(schema, "excerpts");
        expect(excerpts["description"]).toBe("At most 12 items.");

        const reason = propertyOf(excerpts["items"] as Record<string, unknown>, "reason");
        expect(reason["maxLength"]).toBeUndefined();
        expect(reason["description"]).toBe("At most 400 characters.");
    });

    it("수치 상한도 설명으로 옮겨 모델이 범위를 읽게 한다", () => {
        const schema = zodToClaudeOutputSchema(z.object({ score: z.number().min(0).max(100) }));

        const score = propertyOf(schema, "score");
        expect(score["minimum"]).toBeUndefined();
        expect(score["maximum"]).toBeUndefined();
        expect(score["description"]).toBe("At least 0. At most 100.");
    });

    it("제약이 없는 칸에는 설명을 지어내지 않는다", () => {
        const schema = zodToClaudeOutputSchema(z.object({ note: z.string() }));

        expect(propertyOf(schema, "note")["description"]).toBeUndefined();
    });

    it("같은 스키마는 언제나 같은 설명을 낸다", () => {
        const build = (): Record<string, unknown> =>
            zodToClaudeOutputSchema(z.object({ steps: z.array(z.string().max(50)).min(1).max(20) }));

        expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    });
});
