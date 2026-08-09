import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";

/** 대화 스레드의 PostgreSQL 저장 스키마다. */
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

    @Column({ name: "summary_through_message_id", type: "text", nullable: true })
    summaryThroughMessageId!: string | null;

    @Column({ type: "text", nullable: true })
    backend!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}

export function toChatThread(row: ChatThreadEntity): ChatThread {
    const thread = new ChatThread();
    thread.id = row.id;
    thread.userId = row.userId;
    thread.title = row.title;
    thread.summary = row.summary;
    thread.summaryThroughMessageId = row.summaryThroughMessageId;
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
    row.summaryThroughMessageId = thread.summaryThroughMessageId;
    row.backend = thread.implementation;
    row.createdAt = thread.createdAt;
    row.updatedAt = thread.updatedAt;
    return row;
}
