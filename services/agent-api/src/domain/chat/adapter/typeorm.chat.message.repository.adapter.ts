import type { Repository } from "typeorm";
import type { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import type { ChatMessageRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";
import { toChatMessage, toChatMessageRow, type ChatMessageEntity } from "./chat.message.entity.js";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";

export class TypeOrmChatMessageRepository implements ChatMessageRepositoryPort {
    constructor(private readonly repo: Repository<ChatMessageEntity>) {}

    async append(message: ChatMessage): Promise<void> {
        await upsertByKeys(this.repo, toChatMessageRow(message), ["id"]);
    }

    async findById(id: string): Promise<ChatMessage | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toChatMessage(row);
    }

    // 재생은 스레드 안에서 쌓인 순서 그대로다.
    async listByThread(threadId: string): Promise<ChatMessage[]> {
        const rows = await this.repo.find({ where: { threadId }, order: { createdAt: "ASC", id: "ASC" } });
        return rows.map(toChatMessage);
    }

    async deleteByThread(threadId: string): Promise<void> {
        await this.repo.delete({ threadId });
    }
}
