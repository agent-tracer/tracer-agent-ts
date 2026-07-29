import { EvaluationAgentUnsupportedError } from "~agent-worker/domain/evaluation/model/evaluation.error.js";
import type { EvaluationRunEnvelope, EvaluationRunResult } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";
import { EvaluatorRegistry } from "~agent-worker/domain/evaluation/model/evaluator.registry.js";
import type {
    EvaluationAgentRegistry,
    EvaluationDispatchContext,
} from "~agent-worker/domain/evaluation/port/evaluation.agent.port.js";

/** Temporal이 세는 시도 정보만 받고, 잡 봉투에서 실행 식별자를 유도해 registry의 러너를 부른다. */
export interface RunEvaluationTemporalInfo {
    readonly attempt: number;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

/** 평가 실행 한 번을 그 에이전트의 실제 어댑터로 돌린다. */
export class RunEvaluationUsecase {
    constructor(
        private readonly agents: EvaluationAgentRegistry,
        private readonly evaluators: EvaluatorRegistry = new EvaluatorRegistry(),
    ) {}

    async execute(envelope: EvaluationRunEnvelope, temporal: RunEvaluationTemporalInfo): Promise<EvaluationRunResult> {
        const runner = this.agents[envelope.agentName];
        if (runner === undefined) throw new EvaluationAgentUnsupportedError(envelope.agentName);

        const ctx: EvaluationDispatchContext = {
            runId: toRunId(envelope),
            attempt: temporal.attempt,
            ...(temporal.idempotencyKey !== undefined ? { idempotencyKey: temporal.idempotencyKey } : {}),
            ...(temporal.abortSignal !== undefined ? { abortSignal: temporal.abortSignal } : {}),
        };
        const result = await runner.run(envelope, ctx);
        return {
            ...result,
            scores: this.evaluators.evaluate(envelope.evaluatorDefinitions ?? [], {
                output: result.output,
                referenceOutput: envelope.referenceOutput ?? null,
                input: envelope.input,
                evidence: envelope.evidence,
            }),
        };
    }
}

/** experiment_executions의 논리 키를 그대로, 같은 슬롯을 다시 돌려도 같은 실행 식별자로 쓴다. */
function toRunId(envelope: EvaluationRunEnvelope): string {
    return `eval:${envelope.experimentId}:${envelope.variantId}:${envelope.exampleId}:${envelope.repetition}`;
}
