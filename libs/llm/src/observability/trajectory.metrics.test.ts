import { describe, expect, it } from "vitest";
import type { JobStepPayload, JobStepToolCall } from "~llm/model/job.step.js";
import {
    calledToolNames,
    coversExpectedCalls,
    duplicateToolCalls,
    missingToolCalls,
} from "./trajectory.metrics.js";

function step(...toolCalls: readonly JobStepToolCall[]): JobStepPayload {
    return { seq: 1, role: "assistant", content: "", truncated: false, toolCalls };
}

function call(name: string, args: Record<string, unknown> = {}): JobStepToolCall {
    return { id: `c-${name}`, name, args };
}

describe("궤적 지표", () => {
    it("같은 도구를 같은 인자로 다시 부른 횟수를 센다", () => {
        const steps = [
            step(call("search_events", { q: "배포" })),
            step(call("search_events", { q: "배포" })),
        ];

        expect(duplicateToolCalls(steps)).toBe(1);
    });

    it("인자가 다르면 같은 도구여도 중복으로 세지 않는다", () => {
        const steps = [
            step(call("search_events", { q: "배포" })),
            step(call("search_events", { q: "시험" })),
        ];

        expect(duplicateToolCalls(steps)).toBe(0);
    });

    it("인자의 선언 순서가 달라도 같은 호출로 본다", () => {
        const steps = [
            step(call("search_events", { q: "배포", limit: 5 })),
            step(call("search_events", { limit: 5, q: "배포" })),
        ];

        expect(duplicateToolCalls(steps)).toBe(1);
    });

    it("기대한 도구가 모두 나왔는지 순서와 무관하게 본다", () => {
        const steps = [step(call("get_task_events")), step(call("check_citations"))];

        expect(coversExpectedCalls(steps, ["check_citations", "get_task_events"])).toBe(true);
    });

    it("빠뜨린 도구를 이름으로 낸다", () => {
        const steps = [step(call("get_task_events"))];

        expect(missingToolCalls(steps, ["get_task_events", "check_citations"])).toEqual([
            "check_citations",
        ]);
    });

    it("부른 도구 이름을 중복 없이 모은다", () => {
        const steps = [step(call("a"), call("b")), step(call("a"))];

        expect([...calledToolNames(steps)].sort()).toEqual(["a", "b"]);
    });
});
