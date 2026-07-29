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
    insert(job: Job): Promise<void>;
    upsert(job: Job): Promise<void>;
    transitionToCanceled(id: string, now: Date): Promise<boolean>;
}
