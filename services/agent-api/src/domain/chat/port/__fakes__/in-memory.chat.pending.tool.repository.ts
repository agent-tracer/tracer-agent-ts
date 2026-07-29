import type { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import type { ChatPendingToolRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 대기 도구 저장소 포트의 인메모리 대역이며, 같은 id면 덮어써 승인과 거절 전이를 반영한다. */
export class InMemoryChatPendingToolRepository implements ChatPendingToolRepositoryPort {
    private readonly rows = new Map<string, ChatPendingTool>();

    seed(...pendingTools: readonly ChatPendingTool[]): void {
        for (const pendingTool of pendingTools) this.rows.set(pendingTool.id, pendingTool);
    }

    create(pendingTool: ChatPendingTool): Promise<void> {
        this.rows.set(pendingTool.id, pendingTool);
        return Promise.resolve();
    }

    findById(id: string): Promise<ChatPendingTool | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    listByThread(threadId: string): Promise<ChatPendingTool[]> {
        return Promise.resolve([...this.rows.values()].filter((row) => row.threadId === threadId));
    }

    resolve(pendingTool: ChatPendingTool): Promise<void> {
        this.rows.set(pendingTool.id, pendingTool);
        return Promise.resolve();
    }

    deleteByThread(threadId: string): Promise<void> {
        for (const [id, pendingTool] of this.rows) {
            if (pendingTool.threadId === threadId) this.rows.delete(id);
        }
        return Promise.resolve();
    }
}
