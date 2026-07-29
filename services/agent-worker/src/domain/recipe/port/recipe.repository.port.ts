import type { AgentRunObservation, GeneratedJobStep } from "@tracer-agent/llm";
import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type { JobAttemptRecord } from "~agent-worker/support/llm/job.attempt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";

/** 잡의 실행 중 상태를 보는 최소 표현이다. */
export interface RecipeJobSnapshot {
    readonly id: string;
    readonly userId: string;
    readonly taskId: string | null;
    readonly usage: Record<string, unknown>;
}

/** 스캔 앵커 자격 판정에 필요한 태스크 상태다. */
export interface RecipeAnchorSnapshot {
    readonly ownedByUser: boolean;
    readonly scanEligible: boolean;
    readonly sessionScanEligible: boolean;
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
    readonly sourceTaskId: string;
    readonly language: OutputLanguage;
    readonly recipes: readonly GeneratedRecipeCandidate[];
    readonly steps: readonly GeneratedJobStep[];
    readonly attempt: number;
    readonly usage: Record<string, unknown>;
    readonly observation: AgentRunObservation;
    readonly now: Date;
}

/** 레시피 슬라이스가 원장과 읽기 모델에 요구하는 계약이다. */
export interface RecipeRepositoryPort {
    findJob(jobId: string): Promise<RecipeJobSnapshot | null>;
    startJob(jobId: string, now: Date): Promise<boolean>;
    findAnchor(userId: string, taskId: string): Promise<RecipeAnchorSnapshot | null>;
    readSetting(scope: string, key: string): Promise<string | null>;
    findOwnedTaskIds(userId: string, taskIds: readonly string[]): Promise<readonly string[]>;
    recordFailedAttempt(input: RecipeFailedAttempt): Promise<void>;
    foldSuccessAttempt(
        jobId: string,
        record: JobAttemptRecord,
    ): Promise<{
        readonly attempts: readonly JobAttemptRecord[] | undefined;
        readonly costUsd: number | null;
    }>;
    /** 잡 종결과 후보 저장을 한 커밋으로 묶으며 경합에 지면 null을 낸다. */
    commitScan(input: RecipeScanCommit): Promise<{ readonly candidatesCreated: number } | null>;
    failJob(jobId: string, message: string, now: Date): Promise<RecipeJobSnapshot | null>;
}
