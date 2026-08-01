import type { PromptBackend } from "~agent-api/domain/evaluation/model/prompt.model.js";

export type ExperimentStatus = "draft" | "running" | "completed" | "failed" | "cancelled";
export type ExecutionStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface Experiment {
    readonly id: string;
    readonly userId: string;
    readonly datasetId: string;
    readonly datasetRevision: number;
    readonly evaluatorSetVersion: string;
    readonly maxBudgetUsd: number;
    readonly repetitions: number;
    status: ExperimentStatus;
    readonly createdAt: Date;
    completedAt: Date | null;
}

export interface ExperimentVariant {
    readonly id: string;
    readonly experimentId: string;
    readonly name: string;
    readonly baseline: boolean;
    readonly backend: PromptBackend;
    readonly agentName: string;
    readonly promptVersionId: string | null;
    readonly toolContractVersion: string;
    readonly limits: Readonly<Record<string, unknown>>;
    readonly fragmentSelections: Readonly<Record<string, string>>;
}

export interface ExperimentExecution {
    readonly id: string;
    readonly experimentId: string;
    readonly variantId: string;
    readonly exampleId: string;
    readonly repetition: number;
    readonly status: ExecutionStatus;
    readonly output: Record<string, unknown> | null;
    readonly error: string | null;
    readonly costUsd: number;
    readonly startedAt: Date | null;
    readonly completedAt: Date | null;
    /** 이 실행을 몇 번 가져갔는지이며 워커가 정산할 때 이 값을 시도 번호로 되싣는다. */
    readonly attemptCount: number;
    readonly leaseOwner: string | null;
    readonly leaseExpiresAt: Date | null;
    readonly jobId: string | null;
    readonly traceId: string | null;
    /** 이 실행이 실제로 쓴 프롬프트의 해시이며 모든 변형이 같은 프롬프트로 돌았음을 이것이 보인다. */
    readonly resolvedPromptHash: string | null;
    readonly durationMs: number | null;
    readonly failureReason: string | null;
}

/** 시도 하나의 정산이며 실행과 시도의 쌍이 이것을 유일하게 가리킨다. */
export interface EvaluationExecutionSettlementRecord {
    readonly executionId: string;
    readonly attempt: number;
    readonly jobId: string | null;
    readonly traceId: string | null;
    readonly resolvedPromptHash: string | null;
    readonly durationMs: number | null;
    readonly costUsd: number;
    readonly settledAt: Date;
}

export interface EvaluationScore {
    readonly id: string;
    readonly executionId: string;
    readonly evaluatorId: string;
    readonly evaluatorVersion: string;
    readonly score: number;
    readonly label: string | null;
    readonly reason: string | null;
    readonly judgeCostUsd: number;
    readonly createdAt: Date;
}
