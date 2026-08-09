import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
    ChatExecutionPhase,
    ChatExecutionStatus,
    ChatStopReason,
} from "~agent-api/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";

/** 대화 턴 실행 원장의 PostgreSQL 저장 스키마이며 스레드당 running 하나를 부분 유니크 인덱스가 강제한다. */
@Entity({ name: "chat_executions" })
@Index("chat_executions_thread_created", ["threadId", "createdAt"])
@Index("chat_executions_user_status_updated", ["userId", "status", "updatedAt"])
@Index("chat_executions_running_thread", ["threadId"], {
    unique: true,
    where: `"status" = 'running'`,
})
@Index("chat_executions_idempotency", ["userId", "threadId", "clientRequestId"], {
    unique: true,
})
export class ChatExecutionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "thread_id", type: "text" })
    threadId!: string;

    @Column({ name: "replay_anchor_message_id", type: "text" })
    replayAnchorMessageId!: string;

    @Column({ name: "client_request_id", type: "text" })
    clientRequestId!: string;

    @Column({ name: "input_hash", type: "text" })
    inputHash!: string;

    @Column({ type: "text" })
    status!: ChatExecutionStatus;

    @Column({ type: "text", default: "starting" })
    phase!: ChatExecutionPhase;

    @Column({ name: "requested_backend", type: "text", nullable: true })
    requestedBackend!: string | null;

    @Column({ type: "text", nullable: true })
    model!: string | null;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    @Column({ name: "draft_text", type: "text", default: "" })
    draftText!: string;

    @Column({ name: "draft_seq", type: "integer", default: 0 })
    draftSeq!: number;

    @Column({ type: "integer", default: 0 })
    attempt!: number;


    @Column({ name: "assistant_message_id", type: "text", nullable: true })
    assistantMessageId!: string | null;

    @Column({ name: "model_used", type: "text", nullable: true })
    modelUsed!: string | null;

    @Column({ name: "cost_usd", type: "double precision", nullable: true })
    costUsd!: number | null;

    @Column({ name: "num_turns", type: "integer", nullable: true })
    numTurns!: number | null;

    @Column({ name: "stop_reason", type: "text", nullable: true })
    stopReason!: ChatStopReason | null;

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

export function toChatExecution(row: ChatExecutionEntity): ChatExecution {
    const execution = new ChatExecution();
    execution.id = row.id;
    execution.userId = row.userId;
    execution.threadId = row.threadId;
    execution.replayAnchorMessageId = row.replayAnchorMessageId;
    execution.clientRequestId = row.clientRequestId;
    execution.inputHash = row.inputHash;
    execution.status = row.status;
    execution.phase = row.phase;
    execution.requestedBackend = row.requestedBackend;
    execution.model = row.model;
    execution.language = row.language;
    execution.draftText = row.draftText;
    execution.draftSeq = row.draftSeq;
    execution.attempt = row.attempt;
    execution.assistantMessageId = row.assistantMessageId;
    execution.modelUsed = row.modelUsed;
    execution.costUsd = row.costUsd;
    execution.numTurns = row.numTurns;
    execution.stopReason = row.stopReason;
    execution.usage = row.usage;
    execution.error = row.error;
    execution.createdAt = row.createdAt;
    execution.updatedAt = row.updatedAt;
    execution.startedAt = row.startedAt;
    execution.completedAt = row.completedAt;
    return execution;
}

export function toChatExecutionRow(execution: ChatExecution): ChatExecutionEntity {
    const row = new ChatExecutionEntity();
    row.id = execution.id;
    row.userId = execution.userId;
    row.threadId = execution.threadId;
    row.replayAnchorMessageId = execution.replayAnchorMessageId;
    row.clientRequestId = execution.clientRequestId;
    row.inputHash = execution.inputHash;
    row.status = execution.status;
    row.phase = execution.phase;
    row.requestedBackend = execution.requestedBackend;
    row.model = execution.model;
    row.language = execution.language;
    row.draftText = execution.draftText;
    row.draftSeq = execution.draftSeq;
    row.attempt = execution.attempt;
    row.assistantMessageId = execution.assistantMessageId;
    row.modelUsed = execution.modelUsed;
    row.costUsd = execution.costUsd;
    row.numTurns = execution.numTurns;
    row.stopReason = execution.stopReason;
    row.usage = execution.usage;
    row.error = execution.error;
    row.createdAt = execution.createdAt;
    row.updatedAt = execution.updatedAt;
    row.startedAt = execution.startedAt;
    row.completedAt = execution.completedAt;
    return row;
}
