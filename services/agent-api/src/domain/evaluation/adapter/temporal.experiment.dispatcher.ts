import { createTemporalConnection, isWorkflowNotFound } from "~agent-api/config/temporal.factory.js";
import { taskQueuePrefix } from "~agent-api/config/task.queue.js";
import { taskQueueName } from "~agent-api/support/task.queue.js";
import type { ExperimentDispatcherPort } from "../port/experiment.support.port.js";

/** 실험 하나를 태우는 워크플로의 이름이며 값은 계약의 workflow/queues.yaml이 소유한다. */
const EXPERIMENT_WORKFLOW = "evaluationExperimentWorkflow";

/** 계약이 적은 실험 워크플로의 식별자다. */
function experimentWorkflowId(experimentId: string): string {
    return `evaluation:${experimentId}`;
}

export class TemporalExperimentDispatcher implements ExperimentDispatcherPort {
    async dispatch(input: { readonly experimentId: string; readonly userId: string }) {
        const temporal = await createTemporalConnection();
        const workflowId = experimentWorkflowId(input.experimentId);
        try {
            await temporal.client.workflow.start(EXPERIMENT_WORKFLOW, {
                taskQueue: taskQueueName(taskQueuePrefix(), "jobs"),
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
            await temporal.client.workflow.getHandle(experimentWorkflowId(experimentId)).cancel();
            return "cancelled";
        } catch (error) {
            if (isWorkflowNotFound(error)) return "absent";
            throw error;
        } finally {
            await temporal.connection.close();
        }
    }
}
