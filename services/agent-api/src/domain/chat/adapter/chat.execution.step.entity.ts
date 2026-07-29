import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type {
    ChatExecutionStep,
    ChatStepEventKind,
    ChatStepRole,
    ChatStepToolCall,
} from "~agent-api/domain/chat/model/chat.execution.step.model.js";

/** 대화 턴이 부른 모델과 도구의 궤적을 담는 PostgreSQL 저장 스키마다. */
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
    role!: ChatStepRole;

    @Column({ type: "text" })
    content!: string;

    @Column({ type: "boolean", default: false })
    truncated!: boolean;

    @Column({ name: "tool_calls", type: "jsonb", nullable: true })
    toolCalls!: ChatStepToolCall[] | null;

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
    eventKind!: ChatStepEventKind | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

export function toChatExecutionStep(row: ChatExecutionStepEntity): ChatExecutionStep {
    return {
        id: row.id,
        executionId: row.executionId,
        userId: row.userId,
        attempt: row.attempt,
        seq: row.seq,
        role: row.role,
        content: row.content,
        truncated: row.truncated,
        toolCalls: row.toolCalls,
        toolName: row.toolName,
        toolCallId: row.toolCallId,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheReadTokens: row.cacheReadTokens,
        cacheCreationTokens: row.cacheCreationTokens,
        stopReason: row.stopReason,
        nodeName: row.nodeName,
        eventKind: row.eventKind,
        durationMs: row.durationMs,
        createdAt: row.createdAt,
    };
}
