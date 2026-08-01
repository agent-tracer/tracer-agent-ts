import { describe, expect, it } from "vitest";
import { EXECUTION_LEASE_MS } from "~agent-api/domain/evaluation/model/evaluation.execution.policy.js";
import { ExperimentNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import { anExecution, EXPERIMENT_NOW } from "../experiment.test.fixture.js";
import { harness } from "./evaluation.execution.fixture.js";

describe("실행 가져가기", () => {
    it("대기 중인 실행을 가져가고 남은 예산을 함께 낸다", async () => {
        const { repository, lease } = harness();
        repository.executions.push(anExecution({ status: "pending", attemptCount: 0, costUsd: 2 }));

        const leased = await lease.execute({ userId: "user-1", experimentId: "experiment-1", owner: "worker-1" });

        expect(leased?.execution).toMatchObject({ id: "execution-1", status: "running", attemptCount: 1 });
        expect(leased?.priorCostUsd).toBe(2);
        expect(leased?.amount).toBe(8);
    });

    it("가져갈 실행이 없으면 null 을 낸다", async () => {
        const { lease } = harness();

        expect(await lease.execute({ userId: "user-1", experimentId: "experiment-1", owner: "worker-1" })).toBeNull();
    });

    it("이미 쥐고 있는 실행은 시한이 남은 동안 가져가지 않는다", async () => {
        const { repository, lease } = harness();
        repository.executions.push(anExecution({
            status: "running",
            leaseOwner: "worker-1",
            leaseExpiresAt: new Date(EXPERIMENT_NOW.getTime() + EXECUTION_LEASE_MS),
        }));

        expect(await lease.execute({ userId: "user-1", experimentId: "experiment-1", owner: "worker-2" })).toBeNull();
    });

    it("쥔 쪽에 대한 것은 밖으로 내지 않는다", async () => {
        const { repository, lease } = harness();
        repository.executions.push(anExecution({ status: "pending", attemptCount: 0 }));

        const leased = await lease.execute({ userId: "user-1", experimentId: "experiment-1", owner: "worker-1" });

        expect(leased?.execution).not.toHaveProperty("leaseOwner");
        expect(leased?.execution).not.toHaveProperty("leaseExpiresAt");
    });

    it("남의 실험은 가져가지 못한다", async () => {
        const { lease } = harness();

        await expect(lease.execute({ userId: "other", experimentId: "experiment-1", owner: "worker-1" }))
            .rejects.toBeInstanceOf(ExperimentNotFoundError);
    });
});
