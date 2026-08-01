import { describe, expect, it } from "vitest";
import { anExecution, EXPERIMENT_NOW } from "~agent-api/domain/evaluation/application/experiment.test.fixture.js";
import {
    EXECUTION_LEASE_MS,
    finalStatus,
    isLeasable,
    isTerminalExperiment,
    leased,
    released,
    settled,
} from "./evaluation.execution.policy.js";

const LATER = new Date(EXPERIMENT_NOW.getTime() + EXECUTION_LEASE_MS + 1);

describe("가져갈 수 있는 실행", () => {
    it("아무도 가져가지 않은 실행을 가져갈 수 있다", () => {
        expect(isLeasable(anExecution({ status: "pending" }), EXPERIMENT_NOW)).toBe(true);
    });

    it("쥐고 있는 시한이 남았으면 가져갈 수 없다", () => {
        const running = anExecution({ status: "running", leaseExpiresAt: LATER });

        expect(isLeasable(running, EXPERIMENT_NOW)).toBe(false);
    });

    it("쥔 쪽이 시한을 넘기면 되찾을 수 있다", () => {
        const running = anExecution({ status: "running", leaseExpiresAt: EXPERIMENT_NOW });

        expect(isLeasable(running, LATER)).toBe(true);
    });

    it("이미 끝난 실행은 가져가지 않는다", () => {
        expect(isLeasable(anExecution({ status: "succeeded" }), LATER)).toBe(false);
        expect(isLeasable(anExecution({ status: "failed" }), LATER)).toBe(false);
        expect(isLeasable(anExecution({ status: "cancelled" }), LATER)).toBe(false);
    });
});

describe("실행을 가져갈 때", () => {
    it("시도를 하나 올리고 쥔 쪽과 시한을 적는다", () => {
        const next = leased(anExecution({ status: "pending", attemptCount: 0, startedAt: null }), "worker-1", EXPERIMENT_NOW);

        expect(next).toMatchObject({ status: "running", attemptCount: 1, leaseOwner: "worker-1", startedAt: EXPERIMENT_NOW });
        expect(next.leaseExpiresAt?.getTime()).toBe(EXPERIMENT_NOW.getTime() + EXECUTION_LEASE_MS);
    });

    it("되찾은 실행의 처음 시각을 바꾸지 않는다", () => {
        const next = leased(anExecution({ status: "running", attemptCount: 1, startedAt: EXPERIMENT_NOW }), "worker-2", LATER);

        expect(next.startedAt).toBe(EXPERIMENT_NOW);
        expect(next.attemptCount).toBe(2);
    });
});

describe("시도를 정산할 때", () => {
    const facts = {
        attempt: 1,
        output: { answer: "값" },
        costUsd: 0.02,
        durationMs: 1200,
        traceId: "trace-1",
        jobId: "job-1",
        resolvedPromptHash: "hash-1",
    };

    it("결과가 있으면 성공으로 닫고 비용을 더한다", () => {
        const next = settled(anExecution({ status: "running", costUsd: 0.01 }), facts, LATER);

        expect(next).toMatchObject({
            status: "succeeded",
            costUsd: 0.03,
            completedAt: LATER,
            jobId: "job-1",
            traceId: "trace-1",
            resolvedPromptHash: "hash-1",
            durationMs: 1200,
        });
    });

    it("결과가 없으면 실패로 닫는다", () => {
        const next = settled(anExecution({ status: "running" }), { ...facts, output: null }, LATER);

        expect(next.status).toBe("failed");
    });

    it("쥐고 있던 자리를 놓는다", () => {
        const next = settled(anExecution({ status: "running", leaseOwner: "worker-1", leaseExpiresAt: LATER }), facts, LATER);

        expect(next).toMatchObject({ leaseOwner: null, leaseExpiresAt: null });
    });
});

describe("가져간 실행을 돌려놓을 때", () => {
    it("끝이면 실패로 닫고 사유를 적는다", () => {
        const next = released(anExecution({ status: "running", leaseOwner: "worker-1" }), true, "budget", LATER);

        expect(next).toMatchObject({ status: "failed", failureReason: "budget", completedAt: LATER, leaseOwner: null });
    });

    it("끝이 아니면 다음 시도가 가져갈 수 있게 되돌린다", () => {
        const next = released(anExecution({ status: "running", leaseOwner: "worker-1" }), false, "transient", LATER);

        expect(next).toMatchObject({ status: "pending", leaseOwner: null, leaseExpiresAt: null, completedAt: null });
    });
});

describe("실험을 닫을 때", () => {
    it("취소가 다른 사유보다 앞선다", () => {
        expect(finalStatus({ cancelled: true, failed: true, budgetExhausted: true })).toBe("cancelled");
    });

    it("실패가 예산 소진보다 앞선다", () => {
        expect(finalStatus({ cancelled: false, failed: true, budgetExhausted: true })).toBe("failed");
    });

    it("예산이 다해 멈춘 것은 완료로 닫는다", () => {
        expect(finalStatus({ cancelled: false, failed: false, budgetExhausted: true })).toBe("completed");
    });

    it("아무 사유도 없으면 완료로 닫는다", () => {
        expect(finalStatus({ cancelled: false, failed: false, budgetExhausted: false })).toBe("completed");
    });

    it("이미 종결한 실험을 알아본다", () => {
        expect(isTerminalExperiment("completed")).toBe(true);
        expect(isTerminalExperiment("running")).toBe(false);
        expect(isTerminalExperiment("draft")).toBe(false);
    });
});
