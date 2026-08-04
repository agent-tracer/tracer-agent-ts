import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import type { CleanupTaskSnapshot } from "~agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type { GeneratedCleanupSuggestion } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";
import type { JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";

/** 잡의 실행 중 상태를 보는 최소 표현이다. */
export interface CleanupJobSnapshot {
    readonly id: string;
    readonly userId: string;
    readonly usage: Record<string, unknown>;
}

/** 후보 판정에 들어가는 이번 스캔의 태스크 배치다. */
export interface CleanupScanBatch {
    readonly tasks: readonly CleanupTaskSnapshot[];
    /** 상한 없이 조회한 활성 자식의 부모 태스크 ID다. */
    readonly activeChildParentIds: readonly string[];
    /** 조회 상한에 걸려 배치가 태스크 전체를 담지 못했는지 여부다. */
    readonly truncated: boolean;
    /** 후보로 좁히기 전 이번 스캔이 조회한 태스크 수다. */
    readonly tasksScanned: number;
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

/** cleanup 슬라이스가 원장과 읽기 모델에 요구하는 계약이다. */
export interface CleanupRepositoryPort {
    findJob(jobId: string): Promise<CleanupJobSnapshot | null>;
    startJob(jobId: string, now: Date): Promise<boolean>;
    readSetting(scope: string, key: string): Promise<string | null>;
    /** 사용자에게 보이는 태스크만 골라 후보 판정 입력을 만든다. */
    loadScanBatch(userId: string): Promise<CleanupScanBatch>;
    recordFailedAttempt(input: CleanupFailedAttempt): Promise<void>;
    foldSuccessAttempt(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{ readonly attempts: readonly JobAttemptRecord[] | undefined; readonly costUsd: number | null }>;
    /** 잡 원장을 자기 트랜잭션 안에서 종결하며 경합에 지면 null을 낸다. */
    commitCleanup(input: CleanupCommit): Promise<{ readonly suggestionsCreated: number } | null>;
    failJob(jobId: string, message: string, now: Date): Promise<CleanupJobSnapshot | null>;
}
