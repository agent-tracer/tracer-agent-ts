import type { JobStepOrchestrationEventKind, JobStepRole, JobStepToolCall } from "@tracer-agent/llm";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { ChatExecutionStepRecord } from "~agent-worker/domain/chat/port/chat.repository.port.js";

/** 대화 턴이 부른 모델과 도구의 궤적을 담는 저장 스키마다. */
@Entity({ name: "chat_execution_steps" })
@Index("chat_execution_steps_execution_attempt_seq", ["executionId", "attempt", "seq"], { unique: true })
@Index("chat_execution_steps_user_created", ["userId", "createdAt"])
export class ChatExecutionStepEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "execution_id", type: "text" })
    executionId!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "integer", default: 1 })
    attempt!: number;

    @Column({ type: "integer" })
    seq!: number;

    @Column({ type: "text" })
    role!: JobStepRole;

    @Column({ type: "text" })
    content!: string;

    @Column({ type: "boolean", default: false })
    truncated!: boolean;

    @Column({ name: "tool_calls", type: "jsonb", nullable: true })
    toolCalls!: JobStepToolCall[] | null;

    @Column({ name: "tool_name", type: "text", nullable: true })
    toolName!: string | null;

    @Column({ name: "tool_call_id", type: "text", nullable: true })
    toolCallId!: string | null;

    @Column({ name: "input_tokens", type: "integer", nullable: true })
    inputTokens!: number | null;

    @Column({ name: "output_tokens", type: "integer", nullable: true })
    outputTokens!: number | null;

    @Column({ name: "cache_read_tokens", type: "integer", nullable: true })
    cacheReadTokens!: number | null;

    @Column({ name: "cache_creation_tokens", type: "integer", nullable: true })
    cacheCreationTokens!: number | null;

    @Column({ name: "stop_reason", type: "text", nullable: true })
    stopReason!: string | null;

    @Column({ name: "node_name", type: "text", nullable: true })
    nodeName!: string | null;

    @Column({ name: "event_kind", type: "text", nullable: true })
    eventKind!: JobStepOrchestrationEventKind | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

export function toChatExecutionStepRow(record: ChatExecutionStepRecord): ChatExecutionStepEntity {
    const { step } = record;
    const row = new ChatExecutionStepEntity();
    row.id = record.id;
    row.executionId = record.executionId;
    row.userId = record.userId;
    row.attempt = record.attempt;
    row.seq = step.seq;
    row.role = step.role;
    row.content = step.content;
    row.truncated = step.truncated;
    row.toolCalls = step.toolCalls.length > 0 ? [...step.toolCalls] : null;
    row.toolName = step.toolName ?? null;
    row.toolCallId = step.toolCallId ?? null;
    row.inputTokens = step.inputTokens ?? null;
    row.outputTokens = step.outputTokens ?? null;
    row.cacheReadTokens = step.cacheReadTokens ?? null;
    row.cacheCreationTokens = step.cacheCreationTokens ?? null;
    row.stopReason = step.stopReason ?? null;
    row.nodeName = step.nodeName ?? null;
    row.eventKind = step.eventKind ?? null;
    row.durationMs = step.durationMs ?? null;
    row.createdAt = record.now;
    return row;
}
