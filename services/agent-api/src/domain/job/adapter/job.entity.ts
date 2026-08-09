import type { AgentAxis } from "@tracer-agent/llm";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { JobExecutor, JobKind, JobStatus } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";

/** 잡 원장의 PostgreSQL 저장 스키마다. */
@Entity({ name: "ai_jobs" })
@Index("ai_jobs_user_kind", ["userId", "kind", "createdAt"])
@Index("ai_jobs_kind_status", ["kind", "status"])
@Index("ai_jobs_active_status_kind_executor", ["status", "kind", "executor"], {
    where: "\"status\" IN ('pending', 'running')",
})
@Index("ai_jobs_active_backend", ["backend", "kind"], {
    where: "\"status\" IN ('pending', 'running')",
})
@Index("ai_jobs_idempotency_key", ["userId", "kind", "idempotencyKey"], {
    unique: true,
    where: "\"idempotency_key\" IS NOT NULL",
})
export class JobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    kind!: JobKind;

    @Column({ type: "text" })
    executor!: JobExecutor;

    @Column({ type: "text" })
    backend!: AgentAxis;

    @Column({ type: "text" })
    status!: JobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ name: "task_id", type: "text", nullable: true })
    taskId!: string | null;

    @Column({ name: "idempotency_key", type: "text", nullable: true })
    idempotencyKey!: string | null;

    @Column({ name: "idempotency_input_hash", type: "text", nullable: true })
    idempotencyInputHash!: string | null;

    @Column({ type: "jsonb", default: {} })
    input!: Record<string, unknown>;

    @Column({ type: "jsonb", default: {} })
    result!: Record<string, unknown>;

    @Column({ type: "jsonb", default: {} })
    usage!: Record<string, unknown>;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null;

    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null;
}

export function toJob(row: JobEntity): Job {
    const job = new Job();
    job.id = row.id;
    job.userId = row.userId;
    job.kind = row.kind;
    job.executor = row.executor;
    job.backend = row.backend;
    job.status = row.status;
    job.attempts = row.attempts;
    job.taskId = row.taskId;
    job.idempotencyKey = row.idempotencyKey;
    job.idempotencyInputHash = row.idempotencyInputHash;
    job.input = row.input;
    job.result = row.result;
    job.usage = row.usage;
    job.error = row.error;
    job.createdAt = row.createdAt;
    job.updatedAt = row.updatedAt;
    job.startedAt = row.startedAt;
    job.completedAt = row.completedAt;
    return job;
}

export function toJobRow(job: Job): JobEntity {
    const row = new JobEntity();
    row.id = job.id;
    row.userId = job.userId;
    row.kind = job.kind;
    row.executor = job.executor;
    row.backend = job.backend;
    row.status = job.status;
    row.attempts = job.attempts;
    row.taskId = job.taskId;
    row.idempotencyKey = job.idempotencyKey;
    row.idempotencyInputHash = job.idempotencyInputHash;
    row.input = job.input;
    row.result = job.result;
    row.usage = job.usage;
    row.error = job.error;
    row.createdAt = job.createdAt;
    row.updatedAt = job.updatedAt;
    row.startedAt = job.startedAt;
    row.completedAt = job.completedAt;
    return row;
}
