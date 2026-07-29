import type {
    EvaluationExecutionFailure,
    EvaluationExecutionLease,
    EvaluationExecutionLeaseInput,
    EvaluationExecutionSettlement,
    EvaluationExperimentFinalization,
} from "~agent-worker/domain/evaluation/model/evaluation.experiment.model.js";

/** tracer-api가 소유한 실험 실행의 lease-settle-finalize 표면이다. */
export interface EvaluationExecutionClient {
    lease(input: EvaluationExecutionLeaseInput): Promise<EvaluationExecutionLease | null>;
    settle(input: EvaluationExecutionSettlement): Promise<void>;
    release(input: EvaluationExecutionFailure): Promise<void>;
    finalize(input: EvaluationExperimentFinalization): Promise<void>;
}
