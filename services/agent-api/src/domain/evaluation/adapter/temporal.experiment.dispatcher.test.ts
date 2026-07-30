import { afterEach, describe, expect, it, vi } from "vitest";

const start = vi.fn();
const close = vi.fn();

vi.mock("~agent-api/config/temporal.factory.js", () => ({
    createTemporalConnection: async () => ({
        connection: { close },
        client: { workflow: { start } },
    }),
    isWorkflowNotFound: () => false,
}));

const { TemporalExperimentDispatcher } = await import("./temporal.experiment.dispatcher.js");

describe("TemporalExperimentDispatcher", () => {
    afterEach(() => {
        start.mockReset();
        close.mockReset();
        delete process.env["AGENT_TASK_QUEUE_PREFIX"];
    });

    it("계약이 적은 이름의 워크플로를 워크플로를 싣는 잡 큐에서 기동한다", async () => {
        process.env["AGENT_TASK_QUEUE_PREFIX"] = "agent-ts";

        const result = await new TemporalExperimentDispatcher().dispatch({
            experimentId: "exp-1",
            userId: "user-1",
        });

        expect(result).toEqual({ workflowId: "evaluation:exp-1" });
        expect(start).toHaveBeenCalledWith(
            "evaluationExperimentWorkflow",
            expect.objectContaining({ taskQueue: "agent-ts-jobs" }),
        );
    });

    it("기동을 마치면 연결을 닫는다", async () => {
        await new TemporalExperimentDispatcher().dispatch({ experimentId: "exp-2", userId: "user-1" });

        expect(close).toHaveBeenCalledOnce();
    });
});
