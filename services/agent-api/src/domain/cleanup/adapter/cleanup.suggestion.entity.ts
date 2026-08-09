import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
    CleanupSuggestionKind,
    CleanupSuggestionStatus,
} from "~agent-api/domain/cleanup/model/cleanup.const.js";
import { CleanupSuggestion } from "~agent-api/domain/cleanup/model/cleanup.suggestion.model.js";

/** 정리 제안 원장의 PostgreSQL 저장 스키마이며 같은 태스크와 종류의 대기 행은 하나뿐이다. */
@Entity({ name: "task_cleanup_suggestions" })
@Index("cleanup_user_status", ["userId", "status", "createdAt"])
@Index("cleanup_pending_task_kind_unique", ["userId", "taskId", "kind"], {
    unique: true,
    where: `"status" = 'pending'`,
})
export class CleanupSuggestionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ type: "text" })
    kind!: CleanupSuggestionKind;

    @Column({ name: "current_value", type: "text", nullable: true })
    currentValue!: string | null;

    @Column({ name: "proposed_value", type: "text", nullable: true })
    proposedValue!: string | null;

    @Column({ type: "text" })
    rationale!: string;

    @Column({ type: "text" })
    status!: CleanupSuggestionStatus;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    @Column({ name: "observed_last_event_at", type: "timestamptz", nullable: true })
    observedLastEventAt!: Date | null;
}

export function toCleanupSuggestion(row: CleanupSuggestionEntity): CleanupSuggestion {
    const suggestion = new CleanupSuggestion();
    suggestion.id = row.id;
    suggestion.userId = row.userId;
    suggestion.jobId = row.jobId;
    suggestion.taskId = row.taskId;
    suggestion.kind = row.kind;
    suggestion.currentValue = row.currentValue;
    suggestion.proposedValue = row.proposedValue;
    suggestion.rationale = row.rationale;
    suggestion.status = row.status;
    suggestion.error = row.error;
    suggestion.createdAt = row.createdAt;
    suggestion.resolvedAt = row.resolvedAt;
    suggestion.observedLastEventAt = row.observedLastEventAt;
    return suggestion;
}

export function toCleanupSuggestionRow(suggestion: CleanupSuggestion): CleanupSuggestionEntity {
    const row = new CleanupSuggestionEntity();
    row.id = suggestion.id;
    row.userId = suggestion.userId;
    row.jobId = suggestion.jobId;
    row.taskId = suggestion.taskId;
    row.kind = suggestion.kind;
    row.currentValue = suggestion.currentValue;
    row.proposedValue = suggestion.proposedValue;
    row.rationale = suggestion.rationale;
    row.status = suggestion.status;
    row.error = suggestion.error;
    row.createdAt = suggestion.createdAt;
    row.resolvedAt = suggestion.resolvedAt;
    row.observedLastEventAt = suggestion.observedLastEventAt;
    return row;
}
