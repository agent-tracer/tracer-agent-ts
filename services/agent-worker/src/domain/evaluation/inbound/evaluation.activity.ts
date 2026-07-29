import { Context } from "@temporalio/activity";
import { guardActivity } from "@tracer-agent/llm";
import { isNonRetryableEvaluationError } from "~agent-worker/domain/evaluation/model/evaluation.error.js";
import type { EvaluationRunEnvelope, EvaluationRunResult } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";
import type { RunEvaluationUsecase } from "~agent-worker/domain/evaluation/application/run.evaluation.usecase.js";

const HEARTBEAT_MS = 10_000;

/** 오케스트레이션 엔진의 활동 표면을 평가 실행 유스케이스에 잇는다. */
export class EvaluationActivity {
    constructor(private readonly runEvaluation: RunEvaluationUsecase) {}

    runEvaluationAgent = async (envelope: EvaluationRunEnvelope): Promise<EvaluationRunResult> => {
        const ctx = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await guardActivity(
                {
                    activity: "runEvaluationAgent",
                    jobId: `${envelope.experimentId}:${envelope.exampleId}:${envelope.variantId}:${envelope.repetition}`,
                    isNonRetryable: isNonRetryableEvaluationError,
                },
                () =>
                    this.runEvaluation.execute(envelope, {
                        attempt: ctx.info.attempt,
                        idempotencyKey: `${ctx.info.workflowExecution?.workflowId ?? envelope.exampleId}-${ctx.info.activityId}`,
                        abortSignal: ctx.cancellationSignal,
                    }),
            );
        } finally {
            clearInterval(heartbeat);
        }
    };
}
