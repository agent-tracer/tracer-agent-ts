import { describe, expect, it } from "vitest";
import { ExecutionAttemptMismatchError, ExecutionNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import { anExecution } from "../experiment.test.fixture.js";
import { harness, SETTLEMENT } from "./evaluation.execution.fixture.js";

describe("시도 정산", () => {
    it("결과와 점수와 비용을 원장에 적는다", async () => {
        const { repository, settle } = harness();
        repository.executions.push(anExecution({ status: "running", attemptCount: 1, costUsd: 0 }));

        expect(await settle.execute(SETTLEMENT)).toEqual({ settled: true });

        expect(repository.executions[0]).toMatchObject({
            status: "succeeded", costUsd: 0.5, jobId: "job-1", traceId: "trace-1", resolvedPromptHash: "hash-1",
        });
        expect(repository.scores).toHaveLength(1);
    });

    it("같은 시도가 다시 오면 점수와 비용을 다시 적지 않는다", async () => {
        const { repository, settle } = harness();
        repository.executions.push(anExecution({ status: "running", attemptCount: 1, costUsd: 0 }));

        await settle.execute(SETTLEMENT);
        expect(await settle.execute(SETTLEMENT)).toEqual({ settled: false });

        expect(repository.scores).toHaveLength(1);
        expect(repository.executions[0]?.costUsd).toBe(0.5);
    });

    it("결과가 없으면 실패로 닫는다", async () => {
        const { repository, settle } = harness();
        repository.executions.push(anExecution({ status: "running", attemptCount: 1 }));

        await settle.execute({ ...SETTLEMENT, output: null });

        expect(repository.executions[0]?.status).toBe("failed");
    });

    it("원장이 모르는 시도를 거절한다", async () => {
        const { repository, settle } = harness();
        repository.executions.push(anExecution({ status: "running", attemptCount: 1 }));

        await expect(settle.execute({ ...SETTLEMENT, attempt: 2 }))
            .rejects.toBeInstanceOf(ExecutionAttemptMismatchError);
    });

    it("남의 실행은 정산하지 못한다", async () => {
        const { repository, settle } = harness();
        repository.executions.push(anExecution({ status: "running", attemptCount: 1 }));

        await expect(settle.execute({ ...SETTLEMENT, userId: "other" }))
            .rejects.toBeInstanceOf(ExecutionNotFoundError);
    });
});
