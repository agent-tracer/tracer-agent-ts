import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    JOB_STATUS,
    isCancelableJobStatus,
    isTerminalJobStatus,
    type JobExecutor,
    type JobKind,
    type JobStatus,
} from "~agent-worker/support/job.const.js";

/** 접수가 세운 잡 하나의 수명이며 워커는 시작과 종결과 시도 누적만 만진다. */
@Entity({ name: "ai_jobs" })
@Index("ai_jobs_user_kind", ["userId", "kind", "createdAt"])
@Index("ai_jobs_kind_status", ["kind", "status"])
export class AiJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    kind!: JobKind;

    @Column({ type: "text" })
    executor!: JobExecutor;

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

    @Column({ name: "lease_owner", type: "text", nullable: true })
    leaseOwner!: string | null;

    @Column({ name: "lease_expires_at", type: "timestamptz", nullable: true })
    leaseExpiresAt!: Date | null;

    start(now: Date): void {
        // 활동 재시도로 인한 재진입은 시도 횟수만 늘리는 멱등 처리로 흡수한다.
        if (this.status === JOB_STATUS.running) {
            this.attempts += 1;
            this.updatedAt = now;
            return;
        }
        if (this.status !== JOB_STATUS.pending) throw new Error("job.not-pending");
        this.status = JOB_STATUS.running;
        this.attempts += 1;
        this.startedAt = now;
        this.updatedAt = now;
    }

    complete(result: Record<string, unknown>, usage: Record<string, unknown>, now: Date): void {
        if (this.isTerminal()) throw new Error("job.already-terminal");
        this.status = JOB_STATUS.completed;
        this.result = result;
        this.usage = usage;
        this.completedAt = now;
        this.updatedAt = now;
    }

    // 재시도로 소진된 시도의 비용과 궤적을 running 상태를 유지한 채 누적한다.
    recordAttemptUsage(usage: Record<string, unknown>, now: Date): void {
        if (this.isTerminal()) throw new Error("job.already-terminal");
        this.usage = usage;
        this.updatedAt = now;
    }

    fail(error: string, now: Date): void {
        if (this.isTerminal()) throw new Error("job.already-terminal");
        this.status = JOB_STATUS.failed;
        this.error = error;
        this.completedAt = now;
        this.updatedAt = now;
    }

    isTerminal(): boolean {
        return isTerminalJobStatus(this.status);
    }

    isCancelable(): boolean {
        return isCancelableJobStatus(this.status);
    }

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }
}
