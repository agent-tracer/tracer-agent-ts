import { describe, expect, it } from "vitest";
import { ExperimentNotFoundError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import { EXPERIMENT_NOW } from "../experiment.test.fixture.js";
import { harness } from "./evaluation.execution.fixture.js";

describe("실험 종결", () => {
    it("취소를 취소로 닫는다", async () => {
        const { repository, finalize } = harness();

        expect(await finalize.execute({ userId: "user-1", experimentId: "experiment-1", cancelled: true, failed: false, budgetExhausted: false }))
            .toEqual({ status: "cancelled" });
        expect(repository.experiments[0]?.completedAt).toEqual(EXPERIMENT_NOW);
    });

    it("예산이 다한 것은 완료로 닫는다", async () => {
        const { finalize } = harness();

        expect(await finalize.execute({ userId: "user-1", experimentId: "experiment-1", cancelled: false, failed: false, budgetExhausted: true }))
            .toEqual({ status: "completed" });
    });

    it("이미 종결한 실험을 다시 닫지 않는다", async () => {
        const { finalize } = harness();

        await finalize.execute({ userId: "user-1", experimentId: "experiment-1", cancelled: true, failed: false, budgetExhausted: false });

        expect(await finalize.execute({ userId: "user-1", experimentId: "experiment-1", cancelled: false, failed: true, budgetExhausted: false }))
            .toEqual({ status: "cancelled" });
    });

    it("없는 실험을 닫으면 404 로 알린다", async () => {
        const { finalize } = harness();

        await expect(finalize.execute({ userId: "user-1", experimentId: "nowhere", cancelled: false, failed: false, budgetExhausted: false }))
            .rejects.toBeInstanceOf(ExperimentNotFoundError);
    });
});
