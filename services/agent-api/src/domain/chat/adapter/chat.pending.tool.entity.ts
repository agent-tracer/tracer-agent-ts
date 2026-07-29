import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { CHAT_PENDING_TOOL_STATUS, type ChatPendingToolStatus } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";

/** 승인 대기 도구 행의 PostgreSQL 저장 스키마다. */
@Entity({ name: "chat_pending_tools" })
@Index("chat_pending_tools_thread_status", ["threadId", "status"])
export class ChatPendingToolEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "thread_id", type: "text" })
    threadId!: string;

    @Column({ name: "message_id", type: "text", nullable: true })
    messageId!: string | null;

    @Column({ name: "tool_name", type: "text" })
    toolName!: string;

    @Column({ type: "jsonb", default: {} })
    args!: Record<string, unknown>;

    @Column({ type: "text", default: CHAT_PENDING_TOOL_STATUS.pending })
    status!: ChatPendingToolStatus;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;
}

export function toChatPendingTool(row: ChatPendingToolEntity): ChatPendingTool {
    const pending = new ChatPendingTool();
    pending.id = row.id;
    pending.threadId = row.threadId;
    pending.messageId = row.messageId;
    pending.toolName = row.toolName;
    pending.args = row.args;
    pending.status = row.status;
    pending.createdAt = row.createdAt;
    pending.resolvedAt = row.resolvedAt;
    return pending;
}

export function toChatPendingToolRow(pending: ChatPendingTool): ChatPendingToolEntity {
    const row = new ChatPendingToolEntity();
    row.id = pending.id;
    row.threadId = pending.threadId;
    row.messageId = pending.messageId;
    row.toolName = pending.toolName;
    row.args = pending.args;
    row.status = pending.status;
    row.createdAt = pending.createdAt;
    row.resolvedAt = pending.resolvedAt;
    return row;
}
