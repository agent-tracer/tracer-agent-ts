import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import {
    CLEANUP_SUGGESTION_KIND_ARCHIVE,
    CLEANUP_SUGGESTION_STATUS_PENDING,
} from "~agent-worker/domain/cleanup/model/cleanup.const.js";
import type { GeneratedCleanupSuggestion } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";

const ARCHIVE_PROPOSAL = JSON.stringify({ archive: true });

export interface CleanupSuggestionEntityInput {
    readonly id: string;
    readonly userId: string;
    readonly jobId: string;
    readonly suggestion: GeneratedCleanupSuggestion;
}

/** 대기 중인 보관 제안 하나를 저장하는 행이다. */
@Entity({ name: "task_cleanup_suggestions" })
@Index("cleanup_user_status", ["userId", "status", "createdAt"])
@Index("cleanup_pending_task_kind_unique", ["userId", "taskId", "kind"], {
    unique: true,
    where: "\"status\" = 'pending'",
})
export class TaskCleanupSuggestionEntity {
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

    // 제안을 만들 때 서버가 관찰한 대상 태스크의 마지막 이벤트 시각이며, 수락 시점에 태스크가
    // 그 뒤로 새 활동을 겪었는지 비교하는 기준값이다.
    @Column({ name: "observed_last_event_at", type: "timestamptz", nullable: true })
    observedLastEventAt!: Date | null;

    static pending(input: CleanupSuggestionEntityInput, now: Date): TaskCleanupSuggestionEntity {
        const row = new TaskCleanupSuggestionEntity();
        row.id = input.id;
        row.userId = input.userId;
        row.jobId = input.jobId;
        row.taskId = input.suggestion.taskId;
        row.kind = CLEANUP_SUGGESTION_KIND_ARCHIVE;
        row.currentValue = null;
        row.proposedValue = ARCHIVE_PROPOSAL;
        row.rationale = input.suggestion.rationale;
        row.status = CLEANUP_SUGGESTION_STATUS_PENDING;
        row.error = null;
        row.createdAt = now;
        row.resolvedAt = null;
        row.observedLastEventAt = input.suggestion.observedLastEventAt !== null
            ? new Date(input.suggestion.observedLastEventAt)
            : null;
        return row;
    }
}
