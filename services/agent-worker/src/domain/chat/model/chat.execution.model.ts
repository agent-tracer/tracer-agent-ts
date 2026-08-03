import type { AgentQueryUsage } from "@tracer-agent/llm";
import type { ChatExecutionStatus, ChatStopReason } from "./chat.const.js";

/** 한 시도가 실행한 모델과 지출이며 종결이 이 값을 실행 원장에 기록한다. */
export interface ChatExecutionSpend {
    readonly modelUsed: string;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly stopReason: ChatStopReason;
    readonly usage: AgentQueryUsage | Record<string, unknown>;
}

/** 대화 턴 하나의 수명이며 접수부터 종결까지의 상태와 누적 답변과 지출을 든다. */
export class ChatExecution {
    id!: string;

    userId!: string;

    threadId!: string;

    userMessageId!: string;

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
}
