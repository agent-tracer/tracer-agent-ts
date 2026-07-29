import type { PromptIntegrityContract } from "@tracer-agent/llm";
import type {
    EvaluationEvaluatorDefinition,
    EvaluationRunEnvelope,
    EvaluationRunResult,
    EvaluationScore,
} from "./evaluation.envelope.model.js";

/** tracer-api가 관리하는 실험 하나를 지목하는 워크플로 입력이다. */
export interface EvaluationExperimentInput {
    readonly experimentId: string;
    readonly userId: string;
}

/** 실행 봉투 하나를 실제로 돌리는 표면이며, 실험 단계가 형제 유스케이스를 직접 알지 않도록 이 모양으로만 주입받는다. */
export interface EvaluationEnvelopeRunner {
    execute(envelope: EvaluationRunEnvelope, temporal: { readonly attempt: number }): Promise<EvaluationRunResult>;
}

/** 실험 반복이 끝난 사유를 tracer-api의 실행 상태로 반영하는 입력이다. */
export type EvaluationExperimentFinalizeInput = EvaluationExperimentInput & {
    readonly cancelled: boolean;
    readonly failed: boolean;
    readonly budgetExhausted: boolean;
};

export interface EvaluationExecutionLeaseInput {
    readonly userId: string;
    readonly experimentId: string;
    readonly executionId?: string;
}

export interface EvaluationExecutionLease {
    readonly execution: Record<string, unknown>;
    readonly variant: Record<string, unknown>;
    readonly example: Record<string, unknown>;
    readonly prompt: Record<string, unknown> | null;
    readonly promptIntegrity?: PromptIntegrityContract;
    readonly evaluatorDefinitions: readonly EvaluationEvaluatorDefinition[];
    readonly amount: number;
    readonly priorCostUsd: number;
}

export interface EvaluationExecutionSettlement {
    readonly userId: string;
    readonly executionId: string;
    readonly attempt: number;
    readonly amount: number;
    readonly priorCostUsd: number;
    readonly jobId: string;
    readonly output: Record<string, unknown> | null;
    readonly durationMs: number;
    readonly traceId: string | null;
    readonly costUsd: number;
    readonly scores: readonly EvaluationScore[];
    readonly resolvedPromptHash: string | null;
}

export interface EvaluationExecutionFailure {
    readonly userId: string;
    readonly executionId: string;
    readonly attempt: number;
    readonly terminal: boolean;
}

export type EvaluationExperimentFinalization = EvaluationExperimentFinalizeInput;

function stringField(value: Record<string, unknown>, key: string): string {
    const field = value[key];
    if (typeof field !== "string" || field.length === 0) throw new Error(`evaluation lease field missing: ${key}`);
    return field;
}

function numberField(value: Record<string, unknown>, key: string): number {
    const field = value[key];
    if (typeof field !== "number" || !Number.isInteger(field)) throw new Error(`evaluation lease field missing: ${key}`);
    return field;
}

function recordField(value: Record<string, unknown>, key: string): Record<string, unknown> {
    const field = value[key];
    return field !== null && typeof field === "object" && !Array.isArray(field) ? (field as Record<string, unknown>) : {};
}

function nullableRecord(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
    const field = value[key];
    return field === null ? null : recordField(value, key);
}

function promptFromLease(prompt: Record<string, unknown> | null): EvaluationRunEnvelope["prompt"] {
    if (prompt === null) throw new Error("evaluation fragment-only variants require resolved prompt transport");
    return {
        versionId: stringField(prompt, "id"),
        semanticVersion: stringField(prompt, "semanticVersion"),
        contentHash: stringField(prompt, "contentHash"),
        toolContractVersion: stringField(prompt, "toolContractVersion"),
        outputSchemaVersion: stringField(prompt, "outputSchemaVersion"),
    };
}

/** lease가 돌려준 실행·variant·example 레코드를 실제 실행 봉투로 편성한다. */
export function buildRunEnvelope(experimentId: string, lease: EvaluationExecutionLease): EvaluationRunEnvelope {
    const variant = lease.variant;
    const example = lease.example;
    return {
        experimentId,
        variantId: stringField(variant, "id"),
        exampleId: stringField(example, "id"),
        repetition: numberField(lease.execution, "repetition"),
        agentName: stringField(variant, "agentName") as EvaluationRunEnvelope["agentName"],
        backend: stringField(variant, "backend") as EvaluationRunEnvelope["backend"],
        input: recordField(example, "input"),
        evidence: recordField(example, "evidence"),
        referenceOutput: nullableRecord(example, "referenceOutput"),
        evaluatorDefinitions: lease.evaluatorDefinitions,
        prompt: promptFromLease(lease.prompt),
        ...(lease.promptIntegrity !== undefined ? { promptIntegrity: lease.promptIntegrity } : {}),
        model: stringField(variant, "model"),
    };
}

/** lease된 실행 레코드에서 attemptCount를 읽는다. */
export function attemptFromLease(lease: EvaluationExecutionLease): number {
    return numberField(lease.execution, "attemptCount");
}

/** lease된 실행 레코드에서 실행 식별자를 읽는다. */
export function executionIdFromLease(lease: EvaluationExecutionLease): string {
    return stringField(lease.execution, "id");
}
