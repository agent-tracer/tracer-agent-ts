import type { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import type { ChatMessageRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 메시지 저장소 포트의 인메모리 대역이다. */
export class InMemoryChatMessageRepository implements ChatMessageRepositoryPort {
    private readonly rows: ChatMessage[] = [];

    seed(...messages: readonly ChatMessage[]): void {
        this.rows.push(...messages);
    }

    append(message: ChatMessage): Promise<void> {
        this.rows.push(message);
        return Promise.resolve();
    }

    findById(id: string): Promise<ChatMessage | null> {
        return Promise.resolve(this.rows.find((message) => message.id === id) ?? null);
    }

    listByThread(threadId: string): Promise<ChatMessage[]> {
        return Promise.resolve(
            this.rows
                .filter((message) => message.threadId === threadId)
                .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime()),
        );
    }

    deleteByThread(threadId: string): Promise<void> {
        const remaining = this.rows.filter((message) => message.threadId !== threadId);
        this.rows.length = 0;
        this.rows.push(...remaining);
        return Promise.resolve();
    }
}
