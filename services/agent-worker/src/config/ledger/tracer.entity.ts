import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** 추적 서비스가 소유하는 태스크 읽기 모델이며 이 워커는 근거를 읽고 제목을 되돌려 쓴다. */
@Entity({ name: "tasks" })
@Index("tasks_user_updated", ["userId", "updatedAt"])
export class TaskEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @PrimaryColumn({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ name: "title_rank", type: "text" })
    titleRank!: string;

    @Column({ type: "text" })
    slug!: string;

    @Column({ name: "workspace_path", type: "text", nullable: true })
    workspacePath!: string | null;

    @Column({ type: "text" })
    status!: string;

    @Column({ name: "task_kind", type: "text" })
    taskKind!: string;

    @Column({ type: "text" })
    origin!: string;

    @Column({ name: "parent_task_id", type: "text", nullable: true })
    parentTaskId!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;

    @Column({ name: "last_event_at", type: "timestamptz", nullable: true })
    lastEventAt!: Date | null;
}

/** 사용자별 보관과 숨김 상태이며 스캔 자격 판정이 이 값을 함께 본다. */
@Entity({ name: "task_user_state" })
export class TaskUserStateEntity {
    @PrimaryColumn({ name: "task_id", type: "text" })
    taskId!: string;

    @PrimaryColumn({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "archived_at", type: "timestamptz", nullable: true })
    archivedAt!: Date | null;

    @Column({ name: "hidden_at", type: "timestamptz", nullable: true })
    hiddenAt!: Date | null;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}

/** 태스크 하나의 시간 순서 이벤트이며 에이전트가 근거로 읽는다. */
@Entity({ name: "events" })
@Index("events_user_task_seq", ["userId", "taskId", "seq"])
export class EventEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "seq", type: "bigint" })
    seq!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "turn_id", type: "text", nullable: true })
    turnId!: string | null;

    @Column({ type: "text" })
    kind!: string;

    @Column({ type: "text" })
    lane!: string;

    @Column({ type: "text", default: "" })
    title!: string;

    @Column({ type: "text", nullable: true })
    body!: string | null;

    @Column({ name: "tool_name", type: "text", nullable: true })
    toolName!: string | null;

    @Column({ name: "file_paths", type: "jsonb", default: [] })
    filePaths!: string[];

    @Column({ type: "jsonb", default: {} })
    metadata!: Record<string, unknown>;

    @Column({ name: "occurred_at", type: "timestamptz" })
    occurredAt!: Date;
}

/** 한 번의 요청과 그 응답을 묶은 대화 턴이며 제목 제안이 이 창을 읽는다. */
@Entity({ name: "turns" })
@Index("turns_user_task", ["userId", "taskId", "turnIndex"])
export class TurnEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "session_id", type: "text" })
    sessionId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "turn_index", type: "integer" })
    turnIndex!: number;

    @Column({ type: "text" })
    status!: string;

    @Column({ name: "started_at", type: "timestamptz" })
    startedAt!: Date;

    @Column({ name: "ended_at", type: "timestamptz", nullable: true })
    endedAt!: Date | null;

    @Column({ name: "asked_text", type: "text", nullable: true })
    askedText!: string | null;

    @Column({ name: "assistant_text", type: "text", nullable: true })
    assistantText!: string | null;
}

export const SEARCH_OUTBOX_TARGET = {
    recipe: "recipe",
    memo: "memo",
} as const;

export type SearchOutboxTarget = (typeof SEARCH_OUTBOX_TARGET)[keyof typeof SEARCH_OUTBOX_TARGET];

export interface SearchOutboxEnqueueInput {
    readonly id: string;
    readonly userId: string;
    readonly target: SearchOutboxTarget;
    readonly targetId: string;
    readonly now: Date;
}

/** 검색 색인 쓰기는 트랜잭션에 참여할 수 없어 행으로 남기고 배출자가 재시도한다. */
@Entity({ name: "search_outbox" })
@Index("search_outbox_created", ["createdAt"])
export class SearchOutboxEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    target!: SearchOutboxTarget;

    @Column({ name: "target_id", type: "text" })
    targetId!: string;

    @Column({ name: "attempts", type: "integer", default: 0 })
    attempts!: number;

    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    static enqueue(input: SearchOutboxEnqueueInput): SearchOutboxEntity {
        const row = new SearchOutboxEntity();
        row.id = input.id;
        row.userId = input.userId;
        row.target = input.target;
        row.targetId = input.targetId;
        row.attempts = 0;
        row.lastError = null;
        row.createdAt = input.now;
        return row;
    }
}
