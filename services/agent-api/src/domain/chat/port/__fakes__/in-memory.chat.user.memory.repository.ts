import type { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";
import type { ChatUserMemoryRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 장기기억 저장소 포트의 인메모리 대역이며, 같은 사용자와 키면 덮어써 upsert 의미를 지킨다. */
export class InMemoryChatUserMemoryRepository implements ChatUserMemoryRepositoryPort {
    private readonly rows = new Map<string, ChatUserMemory>();

    seed(...memories: readonly ChatUserMemory[]): void {
        for (const memory of memories) this.rows.set(keyOf(memory.userId, memory.key), memory);
    }

    upsert(memory: ChatUserMemory): Promise<void> {
        this.rows.set(keyOf(memory.userId, memory.key), memory);
        return Promise.resolve();
    }

    listByUser(userId: string): Promise<ChatUserMemory[]> {
        const rows = [...this.rows.values()].filter((memory) => memory.userId === userId);
        rows.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
        return Promise.resolve(rows);
    }
}

function keyOf(userId: string, key: string): string {
    return `${userId} ${key}`;
}
