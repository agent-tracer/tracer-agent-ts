import type { JobSettlement } from "~agent-api/domain/job/model/job.settlement.model.js";
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
export interface JobRepositoryPort {
    findById(id: string): Promise<Job | null>;
    findPending(kind: JobKind): Promise<Job[]>;
    findLatest(userId: string, kind: JobKind, taskId?: string): Promise<Job | null>;
    findHistoryByUser(userId: string, query: JobHistoryQuery): Promise<JobHistoryPage>;
    findByIdempotency(userId: string, kind: JobKind, idempotencyKey: string): Promise<Job | null>;
    /** 같은 멱등키의 행이 이미 있으면 LedgerUniqueViolationError 로 거절하며 드라이버 오류를 올리지 않는다. */
    insert(job: Job): Promise<void>;
    upsert(job: Job): Promise<void>;
    transitionToCanceled(id: string, now: Date): Promise<boolean>;
    claimLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean>;
    renewLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean>;
    settleWithLease(id: string, owner: string, outcome: JobSettlement, now: Date): Promise<boolean>;
    releaseLease(id: string, owner: string, now: Date): Promise<boolean>;
}
