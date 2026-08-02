import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { ChatExecutionStatus, ChatMessageRole, ChatStopReason } from "~agent-worker/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-worker/domain/chat/model/chat.execution.model.js";
import { ChatMessage, type ChatToolCall } from "~agent-worker/domain/chat/model/chat.message.model.js";
import { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";

/** 대화 턴 실행 원장의 저장 스키마이며 스레드당 running 하나를 부분 유니크 인덱스가 강제한다. */
@Entity({ name: "chat_executions" })
@Index("chat_executions_thread_created", ["threadId", "createdAt"])
@Index("chat_executions_running_thread", ["threadId"], { unique: true, where: `"status" = 'running'` })
export class ChatExecutionEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "thread_id", type: "text" })
    threadId!: string;

    @Column({ name: "user_message_id", type: "text" })
    userMessageId!: string;

    @Column({ name: "client_request_id", type: "text" })
    clientRequestId!: string;

    @Column({ name: "input_hash", type: "text" })
    inputHash!: string;

    @Column({ type: "text" })
    status!: ChatExecutionStatus;

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

    @Column({ name: "draft_token_hash", type: "text", nullable: true })
    draftTokenHash!: string | null;

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

/** 대화 스레드의 저장 스키마다. */
@Entity({ name: "chat_threads" })
@Index("chat_threads_user_updated", ["userId", "updatedAt"])
export class ChatThreadEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text", nullable: true })
    summary!: string | null;

    @Column({ type: "text", nullable: true })
    backend!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}

/** 대화 메시지의 저장 스키마이며 재생이 스레드 안 순서를 복원한다. */
@Entity({ name: "chat_messages" })
@Index("chat_messages_thread_created", ["threadId", "createdAt"])
export class ChatMessageEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "thread_id", type: "text" })
    threadId!: string;

    @Column({ type: "text" })
    role!: ChatMessageRole;

    @Column({ type: "text" })
    content!: string;

    @Column({ name: "tool_calls", type: "jsonb", nullable: true })
    toolCalls!: ChatToolCall[] | null;

    @Column({ name: "tool_call_id", type: "text", nullable: true })
    toolCallId!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

export function toChatExecution(row: ChatExecutionEntity): ChatExecution {
    const execution = new ChatExecution();
    execution.id = row.id;
    execution.userId = row.userId;
    execution.threadId = row.threadId;
    execution.userMessageId = row.userMessageId;
    execution.clientRequestId = row.clientRequestId;
    execution.inputHash = row.inputHash;
    execution.status = row.status;
    execution.requestedBackend = row.requestedBackend;
    execution.model = row.model;
    execution.language = row.language;
    execution.draftText = row.draftText;
    execution.draftSeq = row.draftSeq;
    execution.attempt = row.attempt;
    execution.draftTokenHash = row.draftTokenHash;
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

export function toChatThread(row: ChatThreadEntity): ChatThread {
    const thread = new ChatThread();
    thread.id = row.id;
    thread.userId = row.userId;
    thread.title = row.title;
    thread.summary = row.summary;
    thread.implementation = row.backend;
    thread.createdAt = row.createdAt;
    thread.updatedAt = row.updatedAt;
    return thread;
}

export function toChatThreadRow(thread: ChatThread): ChatThreadEntity {
    const row = new ChatThreadEntity();
    row.id = thread.id;
    row.userId = thread.userId;
    row.title = thread.title;
    row.summary = thread.summary;
    row.backend = thread.implementation;
    row.createdAt = thread.createdAt;
    row.updatedAt = thread.updatedAt;
    return row;
}

export function toChatMessage(row: ChatMessageEntity): ChatMessage {
    const message = new ChatMessage();
    message.id = row.id;
    message.threadId = row.threadId;
    message.role = row.role;
    message.content = row.content;
    message.toolCalls = row.toolCalls;
    message.toolCallId = row.toolCallId;
    message.createdAt = row.createdAt;
    return message;
}

export function toChatMessageRow(message: ChatMessage): ChatMessageEntity {
    const row = new ChatMessageEntity();
    row.id = message.id;
    row.threadId = message.threadId;
    row.role = message.role;
    row.content = message.content;
    row.toolCalls = message.toolCalls === null ? null : [...message.toolCalls];
    row.toolCallId = message.toolCallId;
    row.createdAt = message.createdAt;
    return row;
}
