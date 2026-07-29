import type { EvaluationRunResult } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";
import type { EvaluationExecutionClient } from "~agent-worker/domain/evaluation/port/evaluation.execution.client.port.js";
import {
    attemptFromLease,
    buildRunEnvelope,
    executionIdFromLease,
    type EvaluationEnvelopeRunner,
    type EvaluationExperimentFinalizeInput,
    type EvaluationExperimentInput,
} from "~agent-worker/domain/evaluation/model/evaluation.experiment.model.js";

/** tracer-api가 lease한 한 logical execution을 실행하고 결과를 다시 반영한다. */
export class RunExperimentStepUsecase {
    constructor(
        private readonly client: EvaluationExecutionClient,
        private readonly runEvaluation: EvaluationEnvelopeRunner,
    ) {}

    async execute(input: EvaluationExperimentInput): Promise<boolean> {
        const lease = await this.client.lease({ userId: input.userId, experimentId: input.experimentId });
        if (lease === null) return false;

        const attempt = attemptFromLease(lease);
        const executionId = executionIdFromLease(lease);
        const envelope = buildRunEnvelope(input.experimentId, lease);

        let result: EvaluationRunResult;
        try {
            result = await this.runEvaluation.execute(envelope, { attempt });
        } catch (error) {
            await this.client.release({
                userId: input.userId,
                executionId,
                attempt,
                terminal: error instanceof Error && error.name === "not_evaluable",
            });
            throw error;
        }

        await this.client.settle({
            userId: input.userId,
            executionId,
            attempt,
            amount: lease.amount,
            priorCostUsd: lease.priorCostUsd,
            jobId: result.jobId,
            output: result.output,
            durationMs: result.observation.durationMs,
            traceId: result.observation.modelCalls[0]?.providerRequestId ?? null,
            costUsd: result.observation.costUsd ?? 0,
            scores: result.scores ?? [],
            resolvedPromptHash: result.observation.resolvedPromptHash ?? null,
        });
        return true;
    }

    finalize(input: EvaluationExperimentFinalizeInput): Promise<void> {
        return this.client.finalize(input);
    }
}
