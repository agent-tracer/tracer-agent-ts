import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import type { JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";
import type { TitleSuggestionPayload } from "~agent-worker/domain/title/model/title.suggestion.schema.js";

/** 잡의 실행 중 상태를 보는 최소 표현이다. */
export interface TitleJobSnapshot {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string | null;
    readonly usage: Record<string, unknown>;
}

export interface TitleFailedAttempt {
    readonly jobId: string;
    readonly userId: string;
    readonly steps: readonly GeneratedJobStep[];
    readonly record: JobAttemptRecord;
    readonly observation: AgentRunObservation;
    readonly now: Date;
}

export interface TitleSuggestionCommit {
    readonly jobId: string;
    readonly userId: string;
    readonly suggestions: readonly TitleSuggestionPayload[];
    readonly steps: readonly GeneratedJobStep[];
    readonly attempt: number;
    readonly usage: Record<string, unknown>;
    readonly observation: AgentRunObservation;
    readonly now: Date;
}

/** 제목 슬라이스가 잡 원장에 요구하는 계약이며 이 포트의 모든 호출은 agent-db 연결 하나로 끝난다. */
export interface TitleJobLedgerPort {
    findJob(jobId: string): Promise<TitleJobSnapshot | null>;
    startJob(jobId: string, now: Date): Promise<boolean>;
    recordFailedAttempt(input: TitleFailedAttempt): Promise<void>;
    /** 원장을 읽어 누적 시도와 비용을 계산할 뿐 아무것도 적지 않는다. */
    readSuccessAttemptUsage(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{
        readonly attempts: readonly JobAttemptRecord[] | undefined;
        readonly costUsd: number | null;
    }>;
    /** 잡 종결과 궤적 저장을 한 커밋으로 묶으며 경합에 지면 null을 낸다. */
    commitSuggestions(input: TitleSuggestionCommit): Promise<{ readonly suggestionsCreated: number } | null>;
    failJob(jobId: string, message: string, now: Date): Promise<TitleJobSnapshot | null>;
}
