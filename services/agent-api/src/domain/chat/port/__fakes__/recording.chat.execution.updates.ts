import type {
    ChatExecutionUpdatePublisherPort,
    ChatExecutionUpdateSubscriberPort,
} from "~agent-api/domain/chat/port/chat.execution.update.port.js";

/** 갱신 통지 포트의 대역이며 누구에게 알렸는지만 적어 둔다. */
export class RecordingChatExecutionUpdates
implements ChatExecutionUpdatePublisherPort, ChatExecutionUpdateSubscriberPort {
    readonly published: string[] = [];
    private readonly listeners = new Map<string, Set<() => void>>();

    publish(executionId: string): void {
        this.published.push(executionId);
        for (const listener of this.listeners.get(executionId) ?? []) listener();
    }

    subscribe(executionId: string, listener: () => void): () => void {
        const listeners = this.listeners.get(executionId) ?? new Set<() => void>();
        listeners.add(listener);
        this.listeners.set(executionId, listeners);
        return () => listeners.delete(listener);
    }
}
