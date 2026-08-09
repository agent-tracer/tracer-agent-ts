import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** 이 워커가 제안을 적는 정리 제안 원장의 표이며 대기 행은 태스크와 종류마다 하나뿐이다. */
@Entity({ name: "task_cleanup_suggestions" })
@Index("cleanup_user_status", ["userId", "status", "createdAt"])
@Index("cleanup_pending_task_kind_unique", ["userId", "taskId", "kind"], {
    unique: true,
    where: `"status" = 'pending'`,
})
export class CleanupSuggestionRowEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    kind!: string;

    @Column({ name: "current_value", type: "text", nullable: true })
    currentValue!: string | null;

    @Column({ name: "proposed_value", type: "text", nullable: true })
    proposedValue!: string | null;

    @Column({ type: "text" })
    rationale!: string;

    @Column({ type: "text" })
    status!: string;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    @Column({ name: "observed_last_event_at", type: "timestamptz", nullable: true })
    observedLastEventAt!: Date | null;
}
