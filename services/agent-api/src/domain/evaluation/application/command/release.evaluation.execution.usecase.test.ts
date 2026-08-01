import { describe, expect, it } from "vitest";
import { anExecution } from "../experiment.test.fixture.js";
import { harness } from "./evaluation.execution.fixture.js";

describe("가져간 실행 돌려놓기", () => {
    it("끝이 아니면 다음 시도가 가져갈 수 있게 되돌린다", async () => {
        const { repository, release } = harness();
        repository.executions.push(anExecution({ status: "running", attemptCount: 1, leaseOwner: "worker-1" }));

        expect(await release.execute({ userId: "user-1", executionId: "execution-1", attempt: 1, terminal: false }))
            .toEqual({ status: "pending" });
        expect(repository.executions[0]?.leaseOwner).toBeNull();
    });

    it("끝이면 실패로 닫고 사유를 남긴다", async () => {
        const { repository, release } = harness();
        repository.executions.push(anExecution({ status: "running", attemptCount: 1 }));

        await release.execute({ userId: "user-1", executionId: "execution-1", attempt: 1, terminal: true, failureReason: "budget" });

        expect(repository.executions[0]).toMatchObject({ status: "failed", failureReason: "budget" });
    });

    it("이미 닫힌 실행은 그 상태를 그대로 낸다", async () => {
        const { repository, release } = harness();
        repository.executions.push(anExecution({ status: "succeeded", attemptCount: 1 }));

        expect(await release.execute({ userId: "user-1", executionId: "execution-1", attempt: 1, terminal: true }))
            .toEqual({ status: "succeeded" });
    });
});
