import type { QueryDeepPartialEntity, Repository } from "typeorm";
import { JOB_STATUS, type JobKind } from "~agent-api/domain/job/model/job.const.js";
import type { Job } from "~agent-api/domain/job/model/job.model.js";
import type {
    JobLeaseOutcome,
    JobHistoryPage,
    JobHistoryQuery,
    JobRepositoryPort,
} from "~agent-api/domain/job/port/job.repository.port.js";
import type { JobEntity} from "./job.entity.js";
import { toJob, toJobRow } from "./job.entity.js";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";

export class TypeOrmJobRepository implements JobRepositoryPort {
    constructor(private readonly repo: Repository<JobEntity>) {}

    async findById(id: string): Promise<Job | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toJob(row);
    }

    async findPending(kind: JobKind): Promise<Job[]> {
        const rows = await this.repo.find({
            where: { kind, status: JOB_STATUS.pending },
            order: { createdAt: "ASC" },
        });
        return rows.map(toJob);
    }

    async findLatest(userId: string, kind: JobKind, taskId?: string): Promise<Job | null> {
        const row = await this.repo.findOne({
            where: { userId, kind, ...(taskId !== undefined ? { taskId } : {}) },
            order: { createdAt: "DESC" },
        });
        return row === null ? null : toJob(row);
    }

    async findHistoryByUser(userId: string, query: JobHistoryQuery): Promise<JobHistoryPage> {
        const [rows, total] = await this.repo.findAndCount({
            where: {
                userId,
                ...(query.kind !== undefined ? { kind: query.kind } : {}),
                ...(query.status !== undefined ? { status: query.status } : {}),
            },
            order: { createdAt: "DESC" },
            take: query.limit,
            skip: query.offset,
        });
        return { items: rows.map(toJob), total };
    }

    async findByIdempotency(userId: string, kind: JobKind, idempotencyKey: string): Promise<Job | null> {
        const row = await this.repo.findOne({ where: { userId, kind, idempotencyKey } });
        return row === null ? null : toJob(row);
    }

    async insert(job: Job): Promise<void> {
        await this.repo.insert(toJobRow(job) as unknown as QueryDeepPartialEntity<JobEntity>);
    }

    async upsert(job: Job): Promise<void> {
        await upsertByKeys(this.repo, toJobRow(job), ["id"]);
    }

    // 취소는 완료와 실패와 경합하므로 조건부 갱신의 반영 행 수로 승자를 정하며, 읽고 쓰는 방식으로는 막을 수 없다.
    async transitionToCanceled(id: string, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({ status: JOB_STATUS.canceled, completedAt: now, updatedAt: now })
            .where("id = :id", { id })
            .andWhere("status IN (:...cancelable)", {
                cancelable: [JOB_STATUS.pending, JOB_STATUS.running],
            })
            // 대기 중 취소는 실행이 없고, 실행 중 취소는 그 시도의 취소 관측이 있거나 관측이 하나도 없을 때 닫는다.
            .andWhere(`("status" = :pending OR EXISTS (
                SELECT 1 FROM "agent_run_observations" observation
                WHERE observation."execution_id" = "ai_jobs"."id"
                  AND observation."user_id" = "ai_jobs"."user_id"
                  AND observation."status" = 'cancelled'
            ) OR NOT EXISTS (
                SELECT 1 FROM "agent_run_observations" observation
                WHERE observation."execution_id" = "ai_jobs"."id"
            ))`, { pending: JOB_STATUS.pending })
            .execute();
        return (result.affected ?? 0) > 0;
    }

    async claimLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({ status: JOB_STATUS.running, leaseOwner: owner, leaseExpiresAt: expiresAt, startedAt: now, updatedAt: now })
            .where("id = :id", { id })
            // 살아 있는 리스를 남이 가지고 있으면 가져가지 못하고, 만료된 리스는 누구든 가져간다.
            .andWhere("status IN (:...claimable)", { claimable: [JOB_STATUS.pending, JOB_STATUS.running] })
            .andWhere("(lease_owner IS NULL OR lease_owner = :owner OR lease_expires_at IS NULL OR lease_expires_at <= :now)", { owner, now })
            .execute();
        return (result.affected ?? 0) > 0;
    }

    async renewLease(id: string, owner: string, expiresAt: Date, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({ leaseExpiresAt: expiresAt, updatedAt: now })
            .where("id = :id", { id })
            .andWhere("status = :running", { running: JOB_STATUS.running })
            .andWhere("lease_owner = :owner", { owner })
            .andWhere("lease_expires_at > :now", { now })
            .execute();
        return (result.affected ?? 0) > 0;
    }

    async settleWithLease(id: string, owner: string, outcome: JobLeaseOutcome, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: outcome.status,
                ...(outcome.result !== undefined ? { result: outcome.result } : {}),
                ...(outcome.error !== undefined ? { error: outcome.error } : {}),
                leaseOwner: null,
                leaseExpiresAt: null,
                completedAt: now,
                updatedAt: now,
            } as QueryDeepPartialEntity<JobEntity>)
            .where("id = :id", { id })
            .andWhere("status = :running", { running: JOB_STATUS.running })
            .andWhere("lease_owner = :owner", { owner })
            .execute();
        return (result.affected ?? 0) > 0;
    }

    async releaseLease(id: string, owner: string, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({ status: JOB_STATUS.pending, leaseOwner: null, leaseExpiresAt: null, startedAt: null, updatedAt: now })
            .where("id = :id", { id })
            .andWhere("status = :running", { running: JOB_STATUS.running })
            .andWhere("lease_owner = :owner", { owner })
            .execute();
        return (result.affected ?? 0) > 0;
    }
}
