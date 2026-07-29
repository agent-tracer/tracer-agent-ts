import type { Repository } from "typeorm";
import type { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";
import type { ChatUserMemoryRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";
import { toChatUserMemory, toChatUserMemoryRow, type ChatUserMemoryEntity } from "./chat.user.memory.entity.js";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";

export class TypeOrmChatUserMemoryRepository implements ChatUserMemoryRepositoryPort {
    constructor(private readonly repo: Repository<ChatUserMemoryEntity>) {}

    async upsert(memory: ChatUserMemory): Promise<void> {
        await upsertByKeys(this.repo, toChatUserMemoryRow(memory), ["userId", "key"]);
    }

    async listByUser(userId: string): Promise<ChatUserMemory[]> {
        const rows = await this.repo.find({ where: { userId }, order: { updatedAt: "DESC" } });
        return rows.map(toChatUserMemory);
    }
}
