import {
    estimateCostUsd,
    resolveModelAlias,
    type AgentExecutionFailure,
    type AgentQueryUsage,
    type AgentRunSummary,
} from "@tracer-agent/llm";

export const JOB_ATTEMPT_STATUS = {
    failed: "failed",
    succeeded: "succeeded",
} as const;

export type JobAttemptStatus = (typeof JOB_ATTEMPT_STATUS)[keyof typeof JOB_ATTEMPT_STATUS];

/** 재시도로 소진된 시도까지 잡 상세에 남기는 시도 하나의 종결 요약이다. */
export interface JobAttemptRecord {
    readonly attempt: number;
    readonly status: JobAttemptStatus;
    readonly subtype: string | null;
    readonly model: string | null;
    readonly costUsd: number | null;
    readonly durationMs: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly errorMessage: string | null;
    readonly providerRequestId: string | null;
}

export function attemptRecordFromFailure(attempt: number, err: AgentExecutionFailure): JobAttemptRecord {
    return {
        attempt,
        status: JOB_ATTEMPT_STATUS.failed,
        subtype: err.errorSubtype,
        model: err.actualModel === null ? null : resolveModelAlias(err.actualModel),
        costUsd: err.actualModel !== null ? estimateCostUsd(err.actualModel, err.usage) : null,
        durationMs: err.durationMs,
        usage: err.usage,
        errorMessage: err.message,
        providerRequestId: err.providerRequestId,
    };
}

export function attemptRecordFromSuccess(attempt: number, summary: AgentRunSummary): JobAttemptRecord {
    return {
        attempt,
        status: JOB_ATTEMPT_STATUS.succeeded,
        subtype: null,
        model: summary.modelUsed,
        costUsd: summary.costUsd,
        durationMs: summary.durationMs,
        usage: summary.usage,
        errorMessage: null,
        providerRequestId: null,
    };
}

export function readAttempts(usage: Record<string, unknown>): readonly JobAttemptRecord[] {
    const raw = usage["attempts"];
    return Array.isArray(raw) ? (raw as JobAttemptRecord[]) : [];
}

export function sumAttemptCostUsd(attempts: readonly JobAttemptRecord[]): number | null {
    const known = attempts.filter((record) => record.costUsd !== null);
    if (known.length === 0) return null;
    return known.reduce((sum, record) => sum + (record.costUsd ?? 0), 0);
}

/** 이미 쌓인 시도 이력에 이번 시도를 더해 전체 이력과 총비용을 낸다. */
export function foldAttempt(
    priorUsage: Record<string, unknown>,
    record: JobAttemptRecord,
): { readonly attempts: readonly JobAttemptRecord[]; readonly totalCostUsd: number | null } {
    const attempts = [...readAttempts(priorUsage), record];
    return { attempts, totalCostUsd: sumAttemptCostUsd(attempts) };
}

/** 잡에 기록할 사용량 지표이며 재시도가 없었으면 시도 이력을 싣지 않는다. */
export interface AgentUsageSummary extends AgentRunSummary {
    readonly attempt: number;
    readonly attempts?: readonly JobAttemptRecord[] | undefined;
}

export function buildJobUsage(summary: AgentUsageSummary): Record<string, unknown> {
    return {
        model: summary.modelUsed,
        durationMs: summary.durationMs,
        costUsd: summary.costUsd,
        numTurns: summary.numTurns,
        inputTokens: summary.usage?.inputTokens ?? null,
        outputTokens: summary.usage?.outputTokens ?? null,
        cacheReadTokens: summary.usage?.cacheReadTokens ?? null,
        cacheCreationTokens: summary.usage?.cacheCreationTokens ?? null,
        ...(summary.attempts !== undefined ? { attempts: summary.attempts } : {}),
    };
}
