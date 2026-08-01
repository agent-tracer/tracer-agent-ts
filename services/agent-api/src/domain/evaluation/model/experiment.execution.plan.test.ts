import { describe, expect, it } from "vitest";
import { buildPendingExecutions, planExecutionCoordinates } from "./experiment.execution.plan.js";

describe("실험이 돌 자리 편성", () => {
    it("variant 와 example 과 반복의 곱만큼 자리를 낸다", () => {
        const planned = planExecutionCoordinates(["v1", "v2"], ["e1", "e2", "e3"], 2);

        expect(planned).toHaveLength(12);
    });

    it("반복을 1부터 센다", () => {
        const planned = planExecutionCoordinates(["v1"], ["e1"], 3);

        expect(planned.map((coordinate) => coordinate.repetition)).toEqual([1, 2, 3]);
    });

    it("반복이 없으면 자리를 내지 않는다", () => {
        expect(planExecutionCoordinates(["v1"], ["e1"], 0)).toEqual([]);
    });

    it("좌표 셋이 서로 겹치지 않는다", () => {
        const planned = planExecutionCoordinates(["v1", "v2"], ["e1", "e2"], 2);
        const keys = planned.map((c) => `${c.variantId}:${c.exampleId}:${c.repetition}`);

        expect(new Set(keys).size).toBe(planned.length);
    });
});

describe("아직 가져가지 않은 실행", () => {
    it("모든 자리를 대기 상태로 세운다", () => {
        const planned = planExecutionCoordinates(["v1"], ["e1"], 2);

        const executions = buildPendingExecutions("x1", planned, (c) => `${c.variantId}-${c.exampleId}-${c.repetition}`);

        expect(executions.map((execution) => execution.status)).toEqual(["pending", "pending"]);
        expect(executions[0]).toMatchObject({
            id: "v1-e1-1",
            experimentId: "x1",
            attemptCount: 0,
            leaseOwner: null,
            leaseExpiresAt: null,
            costUsd: 0,
            resolvedPromptHash: null,
        });
    });

    it("좌표마다 다른 식별자를 받는다", () => {
        const planned = planExecutionCoordinates(["v1", "v2"], ["e1"], 1);

        const executions = buildPendingExecutions("x1", planned, (c) => `${c.variantId}-${c.exampleId}-${c.repetition}`);

        expect(new Set(executions.map((execution) => execution.id)).size).toBe(2);
    });
});
