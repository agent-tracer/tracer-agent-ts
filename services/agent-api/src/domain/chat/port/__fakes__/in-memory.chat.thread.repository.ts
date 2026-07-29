import type { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import type { ChatThreadRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 스레드 저장소 포트의 인메모리 대역이다. */
export class InMemoryChatThreadRepository implements ChatThreadRepositoryPort {
    private readonly rows = new Map<string, ChatThread>();

    seed(...threads: readonly ChatThread[]): void {
        for (const thread of threads) this.rows.set(thread.id, thread);
    }

    create(thread: ChatThread): Promise<void> {
        this.rows.set(thread.id, thread);
        return Promise.resolve();
    }

    findById(id: string): Promise<ChatThread | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    listByUser(userId: string, limit?: number): Promise<ChatThread[]> {
        const rows = [...this.rows.values()]
            .filter((thread) => thread.userId === userId)
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
        return Promise.resolve(limit !== undefined ? rows.slice(0, limit) : rows);
    }

    update(thread: ChatThread): Promise<void> {
        this.rows.set(thread.id, thread);
        return Promise.resolve();
    }

    deleteById(id: string): Promise<void> {
        this.rows.delete(id);
        return Promise.resolve();
    }
}
