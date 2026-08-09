import { AGENT_BACKEND, type AgentRunObservation } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import {
    CHAT_EXECUTION_STATUS,
    CHAT_STOP_REASON,
    type ChatExecutionStatus,
} from "~agent-worker/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-worker/domain/chat/model/chat.execution.model.js";
import { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import type { ChatTurnResult } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type { ChatExecutionUpdatePublisherPort } from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatIdGeneratorPort } from "~agent-worker/domain/chat/port/chat.id.generator.port.js";
import type { ChatTransactionPort, ChatTx } from "~agent-worker/domain/chat/port/chat.transaction.port.js";

export const NOW = new Date("2026-07-01T00:00:00.000Z");

export class FixedClock implements IClock {
    constructor(private current: Date = NOW) {}

    advance(ms: number): void {
        this.current = new Date(this.current.getTime() + ms);
    }

    nowMs(): number {
        return this.current.getTime();
    }

    nowIso(): string {
        return this.current.toISOString();
    }

    now(): Date {
        return this.current;
    }
}

export class RecordingChatExecutionUpdates implements ChatExecutionUpdatePublisherPort {
    readonly published: string[] = [];

    publish(executionId: string): void {
        this.published.push(executionId);
    }
}

export class SequentialChatIdGenerator implements ChatIdGeneratorPort {
    private seq = 0;

    next(): string {
        this.seq += 1;
        return `step-${this.seq}`;
    }
}

/** 트랜잭션 경계 없이 같은 대역을 그대로 건네주는 대역이다. */
export class PassthroughChatTransaction implements ChatTransactionPort {
    constructor(private readonly tx: ChatTx) {}

    run<T>(work: (tx: ChatTx) => Promise<T>): Promise<T> {
        return work(this.tx);
    }
}

export function chatExecution(overrides: Partial<ChatExecution> = {}): ChatExecution {
    const execution = new ChatExecution();
    execution.id = "exec-1";
    execution.userId = "user-1";
    execution.threadId = "thread-1";
    execution.replayAnchorMessageId = "message-1";
    execution.clientRequestId = "request-1";
    execution.inputHash = "hash-1";
    execution.status = CHAT_EXECUTION_STATUS.queued;
    execution.requestedBackend = AGENT_BACKEND;
    execution.model = null;
    execution.language = null;
    execution.draftText = "";
    execution.draftSeq = 0;
    execution.attempt = 0;
    execution.assistantMessageId = null;
    execution.modelUsed = null;
    execution.costUsd = null;
    execution.numTurns = null;
    execution.stopReason = null;
    execution.usage = {};
    execution.error = null;
    execution.createdAt = NOW;
    execution.updatedAt = NOW;
    execution.startedAt = null;
    execution.completedAt = null;
    return Object.assign(execution, overrides);
}

export function chatThread(overrides: Partial<ChatThread> = {}): ChatThread {
    const thread = new ChatThread();
    thread.id = "thread-1";
    thread.userId = "user-1";
    thread.title = "New conversation";
    thread.summary = null;
    thread.implementation = null;
    thread.createdAt = NOW;
    thread.updatedAt = NOW;
    return Object.assign(thread, overrides);
}

export function chatObservation(
    overrides: Partial<AgentRunObservation> = {},
): AgentRunObservation {
    return {
        executionId: "exec-1",
        attemptId: "1",
        jobId: null,
        agentName: "chat",
        backend: AGENT_BACKEND,
        modelRequested: "claude-sonnet-4-6",
        modelActual: "claude-sonnet-4-6",
        promptVersion: "v0.0.1",
        toolContractVersion: "v0.0.1",
        status: "succeeded",
        durationMs: 10,
        ttftMs: null,
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
        costUsd: 0.01,
        landed: false,
        repairAttempted: false,
        validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
        modelCalls: [],
        toolCalls: [],
        ...overrides,
    };
}

export function chatTurnResult(overrides: Partial<ChatTurnResult> = {}): ChatTurnResult {
    return {
        observation: chatObservation(),
        text: "답변",
        backend: AGENT_BACKEND,
        toolCalls: [],
        modelUsed: "claude-sonnet-4-6",
        costUsd: 0.01,
        numTurns: 1,
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 },
        stopReason: CHAT_STOP_REASON.completed,
        steps: [],
        errorSummary: null,
        ...overrides,
    };
}

export function statusOf(status: ChatExecutionStatus): ChatExecutionStatus {
    return status;
}
