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
