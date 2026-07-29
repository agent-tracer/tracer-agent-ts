import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";

/** 사용자 장기기억의 PostgreSQL 저장 스키마이며 같은 사용자와 키의 기억은 하나뿐이다. */
@Entity({ name: "chat_user_memories" })
@Index("chat_user_memories_unique", ["userId", "key"], { unique: true })
export class ChatUserMemoryEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    key!: string;

    @Column({ type: "text" })
    content!: string;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}

export function toChatUserMemory(row: ChatUserMemoryEntity): ChatUserMemory {
    const memory = new ChatUserMemory();
    memory.id = row.id;
    memory.userId = row.userId;
    memory.key = row.key;
    memory.content = row.content;
    memory.createdAt = row.createdAt;
    memory.updatedAt = row.updatedAt;
    return memory;
}

export function toChatUserMemoryRow(memory: ChatUserMemory): ChatUserMemoryEntity {
    const row = new ChatUserMemoryEntity();
    row.id = memory.id;
    row.userId = memory.userId;
    row.key = memory.key;
    row.content = memory.content;
    row.createdAt = memory.createdAt;
    row.updatedAt = memory.updatedAt;
    return row;
}
