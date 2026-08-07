import { AGENT_BACKEND } from "@tracer-agent/llm";
import {
    CHAT_EXECUTION_STATUS,
    type ChatExecutionPhase,
} from "~agent-api/domain/chat/model/chat.const.js";
import type { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import type { ChatExecutionRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 실행 원장 포트의 인메모리 대역이며 접수의 멱등 제약도 그대로 지킨다. */
export class InMemoryChatExecutionRepository implements ChatExecutionRepositoryPort {
    private readonly rows = new Map<string, ChatExecution>();

    seed(...executions: readonly ChatExecution[]): void {
        for (const execution of executions) this.rows.set(execution.id, execution);
    }

    findById(id: string): Promise<ChatExecution | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    findByIdempotency(
        userId: string,
        threadId: string,
        clientRequestId: string,
    ): Promise<ChatExecution | null> {
        return Promise.resolve(
            [...this.rows.values()].find(
                (row) =>
                    row.userId === userId &&
                    row.threadId === threadId &&
                    row.clientRequestId === clientRequestId,
            ) ?? null,
        );
    }

    findLatestActiveByThread(threadId: string): Promise<ChatExecution | null> {
        return Promise.resolve(
            [...this.rows.values()]
                .filter((row) => row.threadId === threadId && isActive(row))
                .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null,
        );
    }

    listActive(): Promise<ChatExecution[]> {
        return Promise.resolve(
            [...this.rows.values()].filter(isActive).filter(isOwnBackend).sort(compareOldest),
        );
    }

    listByThread(threadId: string, limit?: number): Promise<ChatExecution[]> {
        const rows = [...this.rows.values()]
            .filter((row) => row.threadId === threadId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        return Promise.resolve(limit === undefined ? rows : rows.slice(0, limit));
    }

    recoverStaleRunning(idleBefore: Date, now: Date, threadId?: string): Promise<number> {
        let recovered = 0;
        for (const row of this.rows.values()) {
            if (row.status !== CHAT_EXECUTION_STATUS.running) continue;
            if (!isOwnBackend(row)) continue;
            if (threadId !== undefined && row.threadId !== threadId) continue;
            if (row.updatedAt >= idleBefore) continue;
            row.recover(now);
            recovered += 1;
        }
        return Promise.resolve(recovered);
    }

    checkpointRunning(
        id: string,
        attempt: number,
        draftText: string,
        draftSeq: number,
        phase: ChatExecutionPhase,
        now: Date,
    ): Promise<boolean> {
        const row = this.rows.get(id);
        if (
            row === undefined
            || row.status !== CHAT_EXECUTION_STATUS.running
            || row.attempt !== attempt
            || row.draftSeq >= draftSeq
        ) {
            return Promise.resolve(false);
        }
        row.checkpoint(attempt, draftText, draftSeq, phase, now);
        return Promise.resolve(true);
    }

    cancelActive(id: string, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.isTerminal()) return Promise.resolve(false);
        row.cancel(now);
        return Promise.resolve(true);
    }

    insert(execution: ChatExecution): Promise<void> {
        const duplicate = [...this.rows.values()].some(
            (row) =>
                row.userId === execution.userId &&
                row.threadId === execution.threadId &&
                row.clientRequestId === execution.clientRequestId,
        );
        if (duplicate) return Promise.reject(Object.assign(new Error("duplicate"), { code: "23505" }));
        this.rows.set(execution.id, execution);
        return Promise.resolve();
    }

    deleteByThread(threadId: string): Promise<void> {
        for (const [id, row] of this.rows) {
            if (row.threadId === threadId) this.rows.delete(id);
        }
        return Promise.resolve();
    }
}

function isActive(execution: ChatExecution): boolean {
    return execution.status === CHAT_EXECUTION_STATUS.queued
        || execution.status === CHAT_EXECUTION_STATUS.running;
}

function isOwnBackend(execution: ChatExecution): boolean {
    return execution.requestedBackend === AGENT_BACKEND;
}

function compareOldest(left: ChatExecution, right: ChatExecution): number {
    return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}
