import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import type { GeneratedCleanupSuggestion } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";
import type { JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";

/** 잡의 실행 중 상태를 보는 최소 표현이다. */
export interface CleanupJobSnapshot {
    readonly id: string;
    readonly userId: string;
    readonly usage: Record<string, unknown>;
}

export interface CleanupFailedAttempt {
    readonly jobId: string;
    readonly userId: string;
    readonly steps: readonly GeneratedJobStep[];
    readonly record: JobAttemptRecord;
    readonly observation: AgentRunObservation;
    readonly now: Date;
}

export interface CleanupCommit {
    readonly jobId: string;
    readonly userId: string;
    readonly tasksScanned: number;
    /** 에이전트가 낸 제안이며 잡의 결과에 그대로 실린다. */
    readonly suggestions: readonly GeneratedCleanupSuggestion[];
    readonly steps: readonly GeneratedJobStep[];
    readonly attempt: number;
    readonly usage: Record<string, unknown>;
    readonly observation: AgentRunObservation | null;
    readonly now: Date;
}

/** cleanup 슬라이스가 잡 원장에 요구하는 계약이며 이 포트의 모든 호출은 agent-db 연결 하나로 끝난다. */
export interface CleanupJobLedgerPort {
    findJob(jobId: string): Promise<CleanupJobSnapshot | null>;
    startJob(jobId: string, now: Date): Promise<boolean>;
    recordFailedAttempt(input: CleanupFailedAttempt): Promise<void>;
    /** 원장을 읽어 누적 시도와 비용을 계산할 뿐 아무것도 적지 않는다. */
    readSuccessAttemptUsage(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{ readonly attempts: readonly JobAttemptRecord[] | undefined; readonly costUsd: number | null }>;
    /** 잡 원장을 자기 트랜잭션 안에서 종결하며 경합에 지면 null을 낸다. */
    commitCleanup(input: CleanupCommit): Promise<{ readonly suggestionsCreated: number } | null>;
    failJob(jobId: string, message: string, now: Date): Promise<CleanupJobSnapshot | null>;
}
