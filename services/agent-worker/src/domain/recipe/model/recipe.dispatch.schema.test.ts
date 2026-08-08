import { describe, expect, it } from "vitest";
import {
    MAX_EXCERPTS_PER_PROBE,
    MAX_EXCERPT_CHARS,
    MAX_VERDICT_CHARS,
    salvageProbeReport,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";

function excerpt(text: string): Record<string, unknown> {
    return { taskId: "task-1", eventId: "event-1", text };
}

describe("상한을 넘긴 전문가 보고", () => {
    it("판정을 상한까지 잘라 세운다", () => {
        const report = salvageProbeReport("timeline", {
            verdict: "가".repeat(MAX_VERDICT_CHARS + 22),
            excerpts: [excerpt("근거")],
        });

        expect(report?.verdict).toHaveLength(MAX_VERDICT_CHARS);
        expect(report?.excerpts).toHaveLength(1);
    });

    it("인용 본문과 인용 수를 각각 상한까지 줄인다", () => {
        const report = salvageProbeReport("timeline", {
            verdict: "판정",
            excerpts: Array.from({ length: MAX_EXCERPTS_PER_PROBE + 3 }, () =>
                excerpt("가".repeat(MAX_EXCERPT_CHARS + 10)),
            ),
        });

        expect(report?.excerpts).toHaveLength(MAX_EXCERPTS_PER_PROBE);
        expect(report?.excerpts.every((one) => one.text.length === MAX_EXCERPT_CHARS)).toBe(true);
    });

    it("스스로 닫지 못한 조사이므로 소진으로 적는다", () => {
        const report = salvageProbeReport("rules", { verdict: "판정", exhausted: false });

        expect(report?.exhausted).toBe(true);
    });

    it("맡은 축을 보고가 잘못 적었어도 파견이 정한 축으로 세운다", () => {
        const report = salvageProbeReport("rules", { probe: "timeline", verdict: "판정" });

        expect(report?.probe).toBe("rules");
    });

    it("상한 외의 이유로 어긋난 보고는 세우지 못한다", () => {
        expect(salvageProbeReport("timeline", { verdict: "" })).toBeNull();
        expect(salvageProbeReport("timeline", { verdict: "판정", excerpts: [{ text: "근거" }] })).toBeNull();
        expect(salvageProbeReport("timeline", null)).toBeNull();
        expect(salvageProbeReport("timeline", "판정")).toBeNull();
    });
});
