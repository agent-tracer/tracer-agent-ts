import { AGENT_BACKEND, type AgentRunObservation } from "@tracer-agent/llm";
import {
    CHAT_EXECUTION_CLAIM,
    CHAT_EXECUTION_STATUS,
    type ChatExecutionClaim,
} from "~agent-worker/domain/chat/model/chat.const.js";
import type {
    ChatExecution,
    ChatExecutionSpend,
} from "~agent-worker/domain/chat/model/chat.execution.model.js";
import type { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import type { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import type {
    AgentRunObservationRepositoryPort,
    ChatExecutionRepositoryPort,
    ChatExecutionStepRecord,
    ChatExecutionStepRepositoryPort,
    ChatMessageRepositoryPort,
    ChatThreadRepositoryPort,
} from "~agent-worker/domain/chat/port/chat.repository.port.js";

export class InMemoryChatExecutionRepository implements ChatExecutionRepositoryPort {
    readonly rows = new Map<string, ChatExecution>();

    /** 스레드의 running 자리를 이미 다른 실행이 가지고 있는 상태를 만든다. */
    threadBusy = false;

    add(execution: ChatExecution): ChatExecution {
        this.rows.set(execution.id, execution);
        return execution;
    }

    async findById(id: string): Promise<ChatExecution | null> {
        return this.rows.get(id) ?? null;
    }

    async listQueuedByThread(threadId: string): Promise<ChatExecution[]> {
        return [...this.rows.values()]
            .filter((row) =>
                row.threadId === threadId
                && row.status === CHAT_EXECUTION_STATUS.queued
                && row.requestedBackend === AGENT_BACKEND)
            .sort((left, right) => left.id.localeCompare(right.id));
    }

    async recoverStaleRunning(idleBefore: Date, now: Date, threadId?: string): Promise<number> {
        let recovered = 0;
        for (const row of this.rows.values()) {
            if (row.status !== CHAT_EXECUTION_STATUS.running) continue;
            if (row.requestedBackend !== AGENT_BACKEND) continue;
            if (threadId !== undefined && row.threadId !== threadId) continue;
            if (row.updatedAt.getTime() >= idleBefore.getTime()) continue;
            row.status = CHAT_EXECUTION_STATUS.queued;
            row.startedAt = null;
            row.updatedAt = now;
            recovered += 1;
        }
        if (recovered > 0) this.threadBusy = false;
        return recovered;
    }

    async claimQueued(id: string, now: Date): Promise<ChatExecutionClaim> {
        const row = this.rows.get(id);
        if (row === undefined || row.status !== CHAT_EXECUTION_STATUS.queued) {
            return CHAT_EXECUTION_CLAIM.stale;
        }
        if (this.threadBusy) return CHAT_EXECUTION_CLAIM.threadBusy;
        row.status = CHAT_EXECUTION_STATUS.running;
        row.startedAt = now;
        row.updatedAt = now;
        return CHAT_EXECUTION_CLAIM.claimed;
    }

    async beginAttempt(id: string, attempt: number, draftTokenHash: string, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.status !== CHAT_EXECUTION_STATUS.running || row.attempt > attempt) {
            return false;
        }
        row.attempt = attempt;
        row.draftTokenHash ??= draftTokenHash;
        row.draftText = "";
        row.draftSeq = 0;
        row.updatedAt = now;
        return true;
    }

    async checkpointRunning(
        id: string,
        attempt: number,
        draftText: string,
        draftSeq: number,
        now: Date,
    ): Promise<boolean> {
        const row = this.rows.get(id);
        if (
            row === undefined
            || row.status !== CHAT_EXECUTION_STATUS.running
            || row.attempt !== attempt
            || row.draftSeq >= draftSeq
        ) {
            return false;
        }
        row.draftText = draftText;
        row.draftSeq = draftSeq;
        row.updatedAt = now;
        return true;
    }

    async completeRunning(
        id: string,
        assistantMessageId: string,
        spend: ChatExecutionSpend,
        now: Date,
    ): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.status !== CHAT_EXECUTION_STATUS.running) return false;
        applySpend(row, assistantMessageId, spend, now);
        row.status = CHAT_EXECUTION_STATUS.completed;
        row.completedAt = now;
        return true;
    }

    async recordCanceledOutcome(
        id: string,
        assistantMessageId: string,
        spend: ChatExecutionSpend,
        now: Date,
    ): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.assistantMessageId !== null) return false;
        applySpend(row, assistantMessageId, spend, now);
        return true;
    }

    async failActive(id: string, error: string, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.status === CHAT_EXECUTION_STATUS.completed) return false;
        row.status = CHAT_EXECUTION_STATUS.failed;
        row.error = error;
        row.completedAt = now;
        row.updatedAt = now;
        return true;
    }
}

function applySpend(
    row: ChatExecution,
    assistantMessageId: string,
    spend: ChatExecutionSpend,
    now: Date,
): void {
    row.assistantMessageId = assistantMessageId;
    row.modelUsed = spend.modelUsed;
    row.costUsd = spend.costUsd;
    row.numTurns = spend.numTurns;
    row.stopReason = spend.stopReason;
    row.usage = { ...spend.usage };
    row.updatedAt = now;
}

export class InMemoryChatThreadRepository implements ChatThreadRepositoryPort {
    readonly rows = new Map<string, ChatThread>();

    add(thread: ChatThread): ChatThread {
        this.rows.set(thread.id, thread);
        return thread;
    }

    async findById(id: string): Promise<ChatThread | null> {
        return this.rows.get(id) ?? null;
    }

    async update(thread: ChatThread): Promise<void> {
        this.rows.set(thread.id, thread);
    }
}

export class InMemoryChatMessageRepository implements ChatMessageRepositoryPort {
    readonly rows: ChatMessage[] = [];

    async append(message: ChatMessage): Promise<void> {
        this.rows.push(message);
    }

    async listByThread(threadId: string): Promise<ChatMessage[]> {
        return this.rows.filter((row) => row.threadId === threadId);
    }
}

export class InMemoryChatExecutionStepRepository implements ChatExecutionStepRepositoryPort {
    readonly rows: ChatExecutionStepRecord[] = [];

    async insertMany(steps: readonly ChatExecutionStepRecord[]): Promise<void> {
        this.rows.push(...steps);
    }
}

export class InMemoryAgentRunObservationRepository implements AgentRunObservationRepositoryPort {
    readonly rows: AgentRunObservation[] = [];

    async record(_userId: string, observation: AgentRunObservation): Promise<boolean> {
        this.rows.push(observation);
        return true;
    }
}
