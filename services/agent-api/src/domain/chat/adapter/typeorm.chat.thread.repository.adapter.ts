import type { Repository } from "typeorm";
import type { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import type { ChatThreadRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";
import { toChatThread, toChatThreadRow, type ChatThreadEntity } from "./chat.thread.entity.js";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";

export class TypeOrmChatThreadRepository implements ChatThreadRepositoryPort {
    constructor(private readonly repo: Repository<ChatThreadEntity>) {}

    async create(thread: ChatThread): Promise<void> {
        await upsertByKeys(this.repo, toChatThreadRow(thread), ["id"]);
    }

    async findById(id: string): Promise<ChatThread | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toChatThread(row);
    }

    // 목록 화면은 최신 대화부터 보여준다.
    async listByUser(userId: string, limit?: number): Promise<ChatThread[]> {
        const rows = await this.repo.find({
            where: { userId },
            order: { updatedAt: "DESC" },
            ...(limit !== undefined ? { take: limit } : {}),
        });
        return rows.map(toChatThread);
    }

    async update(thread: ChatThread): Promise<void> {
        await upsertByKeys(this.repo, toChatThreadRow(thread), ["id"]);
    }

    async deleteById(id: string): Promise<void> {
        await this.repo.delete({ id });
    }
}
