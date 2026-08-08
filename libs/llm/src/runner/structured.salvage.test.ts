import { describe, expect, it } from "vitest";
import type { JobStepPayload } from "~llm/model/job.step.js";
import { OUTPUT_TOOL_NAME, lastStructuredAttempt } from "~llm/runner/structured.salvage.js";

function step(seq: number, ...calls: readonly { name: string; args: Record<string, unknown> }[]): JobStepPayload {
    return {
        seq,
        role: "assistant",
        content: "",
        truncated: false,
        toolCalls: calls.map((call, index) => ({ id: `call-${seq}-${index}`, ...call })),
    };
}

describe("거절된 마지막 산출 시도", () => {
    it("가장 나중의 산출 도구 호출을 읽는다", () => {
        const steps = [
            step(0, { name: OUTPUT_TOOL_NAME, args: { verdict: "첫 시도" } }),
            step(1, { name: "search_events", args: { q: "질의" } }),
            step(2, { name: OUTPUT_TOOL_NAME, args: { verdict: "마지막 시도" } }),
        ];

        expect(lastStructuredAttempt(steps)).toEqual({ verdict: "마지막 시도" });
    });

    it("한 스텝이 여러 도구를 열었으면 그중 나중의 산출을 읽는다", () => {
        const steps = [
            step(
                0,
                { name: OUTPUT_TOOL_NAME, args: { verdict: "앞" } },
                { name: OUTPUT_TOOL_NAME, args: { verdict: "뒤" } },
            ),
        ];

        expect(lastStructuredAttempt(steps)).toEqual({ verdict: "뒤" });
    });

    it("산출을 한 번도 열지 않은 궤적은 건질 것이 없다", () => {
        expect(lastStructuredAttempt([step(0, { name: "search_events", args: {} })])).toBeNull();
        expect(lastStructuredAttempt([])).toBeNull();
    });
});
