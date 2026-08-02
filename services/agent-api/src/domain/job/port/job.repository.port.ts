import type { JobKind, JobStatus } from "~agent-api/domain/job/model/job.const.js";
import type { Job } from "~agent-api/domain/job/model/job.model.js";

export const JOB_REPOSITORY = Symbol("JobRepository");

export interface JobHistoryQuery {
    readonly kind?: JobKind;
    readonly status?: JobStatus;
    readonly limit: number;
    readonly offset: number;
}

export interface JobHistoryPage {
    readonly items: readonly Job[];
    readonly total: number;
}

/** 잡 애그리게이트의 조회와 조건부 전이를 제공하는 포트다. */
/** 리스를 쥔 실행기가 잡을 종결하며 남기는 값이다. */
export interface JobLeaseOutcome {
    readonly status: JobStatus;
    readonly result?: Record<string, unknown>;
    readonly error?: string;
}

export interface JobRepositoryPort {
    findById(id: string): Promise<Job | null>;
    findPending(kind: JobKind): Promise<Job[]>;
    findLatest(userId: string, kind: JobKind, taskId?: string): Promise<Job | null>;
    findHistoryByUser(userId: string, query: JobHistoryQuery): Promise<JobHistoryPage>;
    findByIdempotency(userId: string, kind: JobKind, idempotencyKey: string): Promise<Job | null>;
    insert(job: Job): Promise<void>;
    upsert(job: Job): Promise<void>;
    transitionToCanceled(id: string, now: Date): Promise<boolean>;
    claimLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean>;
    renewLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean>;
    settleWithLease(id: string, owner: string, outcome: JobLeaseOutcome, now: Date): Promise<boolean>;
    releaseLease(id: string, owner: string, now: Date): Promise<boolean>;
}
