import type { Repository } from "typeorm";
import type { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import type { ChatPendingToolRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";
import { toChatPendingTool, toChatPendingToolRow, type ChatPendingToolEntity } from "./chat.pending.tool.entity.js";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";

export class TypeOrmChatPendingToolRepository implements ChatPendingToolRepositoryPort {
    constructor(private readonly repo: Repository<ChatPendingToolEntity>) {}

    async create(pendingTool: ChatPendingTool): Promise<void> {
        await upsertByKeys(this.repo, toChatPendingToolRow(pendingTool), ["id"]);
    }

    async findById(id: string): Promise<ChatPendingTool | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toChatPendingTool(row);
    }

    async listByThread(threadId: string): Promise<ChatPendingTool[]> {
        const rows = await this.repo.find({ where: { threadId }, order: { createdAt: "ASC" } });
        return rows.map(toChatPendingTool);
    }

    // 승인과 거절로 전이된 값을 그대로 반영하며, 판정 자체는 도메인이 소유한다.
    async resolve(pendingTool: ChatPendingTool): Promise<void> {
        await upsertByKeys(this.repo, toChatPendingToolRow(pendingTool), ["id"]);
    }

    async deleteByThread(threadId: string): Promise<void> {
        await this.repo.delete({ threadId });
    }
}
