import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type { ProvenanceSnapshot } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import type { JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";

/** 잡의 실행 중 상태를 보는 최소 표현이다. */
export interface RecipeJobSnapshot {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string | null;
    readonly usage: Record<string, unknown>;
}

export interface RecipeFailedAttempt {
    readonly jobId: string;
    readonly userId: string;
    readonly steps: readonly GeneratedJobStep[];
    readonly record: JobAttemptRecord;
    readonly observation: AgentRunObservation;
    readonly now: Date;
}

export interface RecipeScanCommit {
    readonly jobId: string;
    readonly userId: string;
    /** 에이전트가 낸 후보와 그 후보가 인용할 수 있었던 장부이며 잡의 결과에 그대로 실린다. */
    readonly recipes: readonly GeneratedRecipeCandidate[];
    readonly provenance: ProvenanceSnapshot;
    readonly steps: readonly GeneratedJobStep[];
    readonly attempt: number;
    readonly usage: Record<string, unknown>;
    readonly observation: AgentRunObservation;
    readonly now: Date;
}

/** 레시피 슬라이스가 잡 원장에 요구하는 계약이며 이 포트의 모든 호출은 agent-db 연결 하나로 끝난다. */
export interface RecipeJobLedgerPort {
    findJob(jobId: string): Promise<RecipeJobSnapshot | null>;
    startJob(jobId: string, now: Date): Promise<boolean>;
    recordFailedAttempt(input: RecipeFailedAttempt): Promise<void>;
    /** 원장을 읽어 누적 시도와 비용을 계산할 뿐 아무것도 적지 않는다. */
    readSuccessAttemptUsage(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{
        readonly attempts: readonly JobAttemptRecord[] | undefined;
        readonly costUsd: number | null;
    }>;
    /** 잡 원장을 자기 트랜잭션 안에서 종결하며 경합에 지면 null을 낸다. */
    commitScan(input: RecipeScanCommit): Promise<{ readonly candidatesCreated: number } | null>;
    failJob(jobId: string, message: string, now: Date): Promise<RecipeJobSnapshot | null>;
}
