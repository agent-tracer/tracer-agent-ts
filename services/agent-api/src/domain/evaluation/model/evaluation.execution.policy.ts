import type { ExperimentExecution, ExperimentStatus } from "~agent-api/domain/evaluation/model/experiment.model.js";

/** 워커가 실행 하나를 쥐고 있는 시간이며 이보다 오래 조용하면 다른 워커가 되찾는다. */
export const EXECUTION_LEASE_MS = 20 * 60 * 1000;

/** 아직 아무도 가져가지 않았거나 쥔 쪽이 시한을 넘긴 실행만 가져갈 수 있다. */
export function isLeasable(execution: ExperimentExecution, now: Date): boolean {
    if (execution.status === "pending") return true;
    if (execution.status !== "running") return false;
    return execution.leaseExpiresAt !== null && execution.leaseExpiresAt.getTime() <= now.getTime();
}

/** 실행을 가져간 상태로 옮기고 시도를 하나 올린다. */
export function leased(execution: ExperimentExecution, owner: string, now: Date): ExperimentExecution {
    return {
        ...execution,
        status: "running",
        attemptCount: execution.attemptCount + 1,
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + EXECUTION_LEASE_MS),
        startedAt: execution.startedAt ?? now,
    };
}

export interface SettlementFacts {
    readonly attempt: number;
    readonly output: Record<string, unknown> | null;
    readonly costUsd: number;
    readonly durationMs: number;
    readonly traceId: string | null;
    readonly jobId: string;
    readonly resolvedPromptHash: string | null;
}

/** 정산한 시도의 결과를 실행에 적고 쥐고 있던 자리를 놓는다. */
export function settled(execution: ExperimentExecution, facts: SettlementFacts, now: Date): ExperimentExecution {
    return {
        ...execution,
        status: facts.output === null ? "failed" : "succeeded",
        output: facts.output,
        costUsd: execution.costUsd + facts.costUsd,
        completedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        jobId: facts.jobId,
        traceId: facts.traceId,
        resolvedPromptHash: facts.resolvedPromptHash,
        durationMs: facts.durationMs,
    };
}

/** 가져간 실행을 실패로 닫거나 다음 시도가 가져갈 수 있게 되돌린다. */
export function released(
    execution: ExperimentExecution,
    terminal: boolean,
    failureReason: string | null,
    now: Date,
): ExperimentExecution {
    if (terminal) {
        return {
            ...execution,
            status: "failed",
            completedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
            failureReason,
        };
    }
    // 다시 대기로 돌아간 실행은 아직 끝나지 않았으므로 앞선 시도가 남긴 완료 시각을 지운다.
    return { ...execution, status: "pending", leaseOwner: null, leaseExpiresAt: null, completedAt: null, failureReason };
}

export interface FinalizationReason {
    readonly cancelled: boolean;
    readonly failed: boolean;
    readonly budgetExhausted: boolean;
}

/** 반복이 끝난 사유를 실험의 종결 상태로 옮긴다. */
export function finalStatus(reason: FinalizationReason): ExperimentStatus {
    if (reason.cancelled) return "cancelled";
    if (reason.failed) return "failed";
    // 예산이 다해 멈춘 것은 실패가 아니라 정해진 한도까지 돌고 끝난 것이다.
    return "completed";
}

/** 이미 종결한 실험은 다시 닫지 않는다. */
export function isTerminalExperiment(status: ExperimentStatus): boolean {
    return status === "completed" || status === "failed" || status === "cancelled";
}
