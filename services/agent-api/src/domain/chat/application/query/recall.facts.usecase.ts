import { Inject, Injectable } from "@nestjs/common";
import { mapMemory, type ChatUserMemoryDto } from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatUserMemoryRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** recall_facts 도구가 보는 사용자 장기기억 전체를 되읽는다. */
@Injectable()
export class RecallFactsUseCase {
    constructor(
        @Inject(CHAT_USER_MEMORY_REPOSITORY)
        private readonly memories: ChatUserMemoryRepositoryPort,
    ) {}

    async execute(userId: string): Promise<{ readonly facts: readonly ChatUserMemoryDto[] }> {
        const rows = await this.memories.listByUser(userId);
        return { facts: rows.map(mapMemory) };
    }
}
