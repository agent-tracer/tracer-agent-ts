import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { ChatMessageRole } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatMessage, type ChatToolCall } from "~agent-api/domain/chat/model/chat.message.model.js";

/** 대화 메시지의 PostgreSQL 저장 스키마이며 재생이 스레드 안 순서를 복원한다. */
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
