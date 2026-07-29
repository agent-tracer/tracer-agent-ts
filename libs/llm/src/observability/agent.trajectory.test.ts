import { describe, expect, it } from "vitest";
import type { JobStepPayload } from "~llm/model/job.step.js";
import { mergeAgentTrajectory } from "./agent.trajectory.js";

function assistantStep(seq: number, content: string): JobStepPayload {
    return { seq, role: "assistant", content, truncated: false, toolCalls: [] };
}

describe("mergeAgentTrajectory", () => {
    it("여러 호출의 seq를 0부터 다시 매기며 이어 붙인다", () => {
        const merged = mergeAgentTrajectory([
            { nodeName: "survey", steps: [assistantStep(0, "a"), assistantStep(1, "b")] },
            { nodeName: "repair", steps: [assistantStep(0, "c")] },
        ]);

        expect(merged.map((step) => step.seq)).toEqual([0, 1, 2]);
    });

    it("각 스텝에 자기 호출의 노드 이름을 새긴다", () => {
        const merged = mergeAgentTrajectory([
            { nodeName: "survey", steps: [assistantStep(0, "a")] },
            { nodeName: "repair", steps: [assistantStep(0, "b")] },
        ]);

        expect(merged.map((step) => step.nodeName)).toEqual(["survey", "repair"]);
    });

    it("한 호출만 있으면 그대로 하나의 노드 이름만 남는다", () => {
        const merged = mergeAgentTrajectory([
            { nodeName: "survey", steps: [assistantStep(0, "a"), assistantStep(1, "b")] },
        ]);

        expect(merged.map((step) => step.nodeName)).toEqual(["survey", "survey"]);
        expect(merged.map((step) => step.seq)).toEqual([0, 1]);
    });
});
