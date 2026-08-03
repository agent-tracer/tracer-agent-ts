import { AGENT_BACKEND } from "@tracer-agent/llm";
import { InvariantViolationError } from "@tracer-agent/platform";
import {
    CHAT_EXECUTION_STATUS,
    type ChatExecutionStatus,
    type ChatStopReason,
} from "~agent-api/domain/chat/model/chat.const.js";

export interface ChatExecutionCreateInput {
    readonly id: string;
    readonly userId: string;
    readonly threadId: string;
    readonly replayAnchorMessageId: string;
    readonly clientRequestId: string;
    readonly inputHash: string;
    readonly model: string | null;
    readonly language: string | null;
    readonly now: Date;
}

/** 대화 턴 하나의 수명이며 접수부터 종결까지의 상태와 누적 답변과 지출을 든다. */
export class ChatExecution {
    id!: string;

    userId!: string;

    threadId!: string;

    replayAnchorMessageId!: string;

    clientRequestId!: string;

    inputHash!: string;

    status!: ChatExecutionStatus;

    /** 이 실행을 접수한 축이며 접수구가 자기 축을 그대로 적으므로 대기와 실행 중에는 비어 있지 않다. */
    requestedBackend!: string | null;

    model!: string | null;

    language!: string | null;

    draftText!: string;

    draftSeq!: number;

    attempt!: number;

    draftTokenHash!: string | null;

    assistantMessageId!: string | null;

    modelUsed!: string | null;

    costUsd!: number | null;

    numTurns!: number | null;

    stopReason!: ChatStopReason | null;

    usage!: Record<string, unknown>;

    error!: string | null;

    createdAt!: Date;

    updatedAt!: Date;

    startedAt!: Date | null;

    completedAt!: Date | null;

    static create(input: ChatExecutionCreateInput): ChatExecution {
        const execution = new ChatExecution();
        execution.id = input.id;
        execution.userId = input.userId;
        execution.threadId = input.threadId;
        execution.replayAnchorMessageId = input.replayAnchorMessageId;
        execution.clientRequestId = input.clientRequestId;
        execution.inputHash = input.inputHash;
        execution.status = CHAT_EXECUTION_STATUS.queued;
        execution.requestedBackend = AGENT_BACKEND;
        execution.model = input.model;
        execution.language = input.language;
        execution.draftText = "";
        execution.draftSeq = 0;
        execution.attempt = 0;
        execution.draftTokenHash = null;
        execution.assistantMessageId = null;
        execution.modelUsed = null;
        execution.costUsd = null;
        execution.numTurns = null;
        execution.stopReason = null;
        execution.usage = {};
        execution.error = null;
        execution.createdAt = input.now;
        execution.updatedAt = input.now;
        execution.startedAt = null;
        execution.completedAt = null;
        return execution;
    }

    recover(now: Date): void {
        if (this.status !== CHAT_EXECUTION_STATUS.running) {
            throw new InvariantViolationError("chat-execution.not-running");
        }
        this.status = CHAT_EXECUTION_STATUS.queued;
        this.startedAt = null;
        this.updatedAt = now;
    }

    checkpoint(attempt: number, draftText: string, seq: number, now: Date): void {
        if (this.status !== CHAT_EXECUTION_STATUS.running) {
            throw new InvariantViolationError("chat-execution.not-running");
        }
        if (attempt !== this.attempt) return;
        if (seq <= this.draftSeq) return;
        this.draftText = draftText;
        this.draftSeq = seq;
        this.updatedAt = now;
    }

    acceptsDraftToken(tokenHash: string): boolean {
        return this.draftTokenHash !== null && this.draftTokenHash === tokenHash;
    }

    cancel(now: Date): void {
        if (this.isTerminal()) throw new InvariantViolationError("chat-execution.already-terminal");
        this.status = CHAT_EXECUTION_STATUS.canceled;
        this.completedAt = now;
        this.updatedAt = now;
    }

    isTerminal(): boolean {
        return (
            this.status === CHAT_EXECUTION_STATUS.completed ||
            this.status === CHAT_EXECUTION_STATUS.failed ||
            this.status === CHAT_EXECUTION_STATUS.canceled
        );
    }
}
