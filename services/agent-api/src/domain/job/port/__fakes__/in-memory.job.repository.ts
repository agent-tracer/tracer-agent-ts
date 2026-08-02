import { JOB_STATUS, type JobKind } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import type {
    JobLeaseOutcome,
    JobHistoryPage,
    JobHistoryQuery,
    JobRepositoryPort,
} from "~agent-api/domain/job/port/job.repository.port.js";

// Postgres unique_violation.
const UNIQUE_VIOLATION = "23505";

function copy(job: Job): Job {
    return Object.assign(new Job(), job);
}

/** 잡 저장소 포트의 인메모리 대역이며 멱등키 유니크 제약도 그대로 지킨다. */
export class InMemoryJobRepository implements JobRepositoryPort {
    private readonly rows = new Map<string, Job>();

    seed(...jobs: readonly Job[]): void {
        for (const job of jobs) this.rows.set(job.id, copy(job));
    }

    all(): readonly Job[] {
        return [...this.rows.values()];
    }

    findById(id: string): Promise<Job | null> {
        const job = this.rows.get(id);
        return Promise.resolve(job !== undefined ? copy(job) : null);
    }

    findPending(kind: JobKind): Promise<Job[]> {
        return Promise.resolve(
            this.all()
                .filter((job) => job.kind === kind && job.status === JOB_STATUS.pending)
                .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
                .map(copy),
        );
    }

    findLatest(userId: string, kind: JobKind, taskId?: string): Promise<Job | null> {
        const latest = this.all()
            .filter((job) =>
                job.userId === userId
                && job.kind === kind
                && (taskId === undefined || job.taskId === taskId),
            )
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
        return Promise.resolve(latest !== undefined ? copy(latest) : null);
    }

    findHistoryByUser(userId: string, query: JobHistoryQuery): Promise<JobHistoryPage> {
        const matched = this.all()
            .filter((job) =>
                job.userId === userId
                && (query.kind === undefined || job.kind === query.kind)
                && (query.status === undefined || job.status === query.status),
            )
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        const items = matched.slice(query.offset, query.offset + query.limit).map(copy);
        return Promise.resolve({ items, total: matched.length });
    }

    findByIdempotency(userId: string, kind: JobKind, idempotencyKey: string): Promise<Job | null> {
        const found = this.all().find((job) =>
            job.userId === userId && job.kind === kind && job.idempotencyKey === idempotencyKey,
        );
        return Promise.resolve(found !== undefined ? copy(found) : null);
    }

    insert(job: Job): Promise<void> {
        const duplicated = job.idempotencyKey !== null
            && this.all().some((row) =>
                row.userId === job.userId
                && row.kind === job.kind
                && row.idempotencyKey === job.idempotencyKey,
            );
        if (duplicated) {
            return Promise.reject(Object.assign(new Error("duplicate idempotency key"), { code: UNIQUE_VIOLATION }));
        }
        this.rows.set(job.id, copy(job));
        return Promise.resolve();
    }

    upsert(job: Job): Promise<void> {
        this.rows.set(job.id, copy(job));
        return Promise.resolve();
    }

    private readonly leases = new Map<string, { owner: string; expiresAt: Date }>();

    transitionToCanceled(id: string, now: Date): Promise<boolean> {
        const stored = this.rows.get(id);
        if (stored === undefined || !stored.isCancelable()) return Promise.resolve(false);
        stored.cancel(now);
        return Promise.resolve(true);
    }

    claimLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean> {
        const stored = this.rows.get(id);
        if (stored === undefined) return Promise.resolve(false);
        const held = this.leases.get(id);
        if (held !== undefined && held.owner !== owner && held.expiresAt.getTime() > now.getTime()) {
            return Promise.resolve(false);
        }
        this.leases.set(id, { owner, expiresAt });
        return Promise.resolve(true);
    }

    renewLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean> {
        const held = this.leases.get(id);
        if (held === undefined || held.owner !== owner || held.expiresAt.getTime() <= now.getTime()) {
            return Promise.resolve(false);
        }
        this.leases.set(id, { owner, expiresAt });
        return Promise.resolve(true);
    }

    settleWithLease(id: string, owner: string, _outcome: JobLeaseOutcome, _now: Date): Promise<boolean> {
        if (this.leases.get(id)?.owner !== owner) return Promise.resolve(false);
        this.leases.delete(id);
        return Promise.resolve(true);
    }

    releaseLease(id: string, owner: string, _now: Date): Promise<boolean> {
        if (this.leases.get(id)?.owner !== owner) return Promise.resolve(false);
        this.leases.delete(id);
        return Promise.resolve(true);
    }
}
