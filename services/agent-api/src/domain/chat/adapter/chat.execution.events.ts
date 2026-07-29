import { Injectable } from "@nestjs/common";
import type { ChatExecutionUpdateSubscriberPort } from "~agent-api/domain/chat/port/chat.execution.update.port.js";

/** 이 프로세스가 든 열린 연결을 실행 식별자로 묶어 깨운다. */
@Injectable()
export class ChatExecutionEvents implements ChatExecutionUpdateSubscriberPort {
    private readonly listeners = new Map<string, Set<() => void>>();

    publish(executionId: string): void {
        for (const listener of this.listeners.get(executionId) ?? []) listener();
    }

    subscribe(executionId: string, listener: () => void): () => void {
        const listeners = this.listeners.get(executionId) ?? new Set<() => void>();
        listeners.add(listener);
        this.listeners.set(executionId, listeners);
        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) this.listeners.delete(executionId);
        };
    }
}
