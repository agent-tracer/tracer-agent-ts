import { describe, expect, it, vi } from "vitest";

const proxyActivities = vi.fn(() => ({
    runNext: async () => false,
    finalize: async () => undefined,
}));
const workflowInfo = vi.fn(() => ({ taskQueue: "agent-ts-jobs" }));

vi.mock("@temporalio/workflow", () => ({ proxyActivities, workflowInfo }));

const { evaluationExperimentWorkflow } = await import("./evaluation.experiment.workflow.js");

describe("evaluationExperimentWorkflow", () => {
    it("잡 큐에서 돌면서 긴 액티비티는 같은 접두사의 생성 큐로 보낸다", async () => {
        await evaluationExperimentWorkflow({ experimentId: "exp-1", userId: "user-1" });

        expect(proxyActivities).toHaveBeenCalledWith(
            expect.objectContaining({ taskQueue: "agent-ts-generate" }),
        );
    });
});
