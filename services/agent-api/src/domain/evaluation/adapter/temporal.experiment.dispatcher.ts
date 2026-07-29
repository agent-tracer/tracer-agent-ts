import { createTemporalConnection, isWorkflowNotFound } from "~agent-api/config/temporal.factory.js";
import type { ExperimentDispatcherPort } from "../port/experiment.support.port.js";

export class TemporalExperimentDispatcher implements ExperimentDispatcherPort {
    async dispatch(input: { readonly experimentId: string; readonly userId: string }) {
        const temporal = await createTemporalConnection();
        const workflowId = `evaluation-${input.experimentId}`;
        try {
            await temporal.client.workflow.start("runEvaluationExperimentWorkflow", {
                taskQueue: "agent-evaluation",
                workflowId,
                args: [input],
            });
            return { workflowId };
        } finally {
            await temporal.connection.close();
        }
    }

    async cancel(experimentId: string): Promise<"cancelled" | "absent"> {
        const temporal = await createTemporalConnection();
        try {
            await temporal.client.workflow.getHandle(`evaluation-${experimentId}`).cancel();
            return "cancelled";
        } catch (error) {
            if (isWorkflowNotFound(error)) return "absent";
            throw error;
        } finally {
            await temporal.connection.close();
        }
    }
}
