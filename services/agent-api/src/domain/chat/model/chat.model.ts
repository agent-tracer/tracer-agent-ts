import type {
    ChatExecutionPhase,
    ChatExecutionStatus,
    ChatMessageRole,
    ChatStopReason,
} from "~agent-api/domain/chat/model/chat.const.js";
import type { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import type { ChatMessage, ChatToolCall } from "~agent-api/domain/chat/model/chat.message.model.js";
import type { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import type { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";

/** 대화 스레드의 와이어 표현이며 시각은 ISO 문자열이다. */
export interface ChatThreadDto {
    readonly id: string;
    readonly userId: string;
    readonly title: string;
    readonly summary: string | null;
    readonly backend: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface ChatExecutionDto {
    readonly id: string;
    readonly threadId: string;
    readonly replayAnchorMessageId: string;
    readonly status: ChatExecutionStatus;
    /** 실행이 지금 무엇을 하는 중인지이며 값의 목록은 계약이 갖는다. */
    readonly phase: ChatExecutionPhase;
    readonly requestedBackend: string | null;
    readonly draftText: string;
    readonly draftSeq: number;
    readonly assistantMessageId: string | null;
    readonly modelUsed: string | null;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    /** 모델이 응답을 멈춘 이유이며 값이 없으면 아직 끝나지 않은 실행이다. */
    readonly stopReason: ChatStopReason | null;
    readonly error: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
}

/** 대화 메시지의 와이어 표현이며 시각은 ISO 문자열이다. */
export interface ChatMessageDto {
    readonly id: string;
    readonly threadId: string;
    readonly role: ChatMessageRole;
    readonly content: string;
    readonly toolCalls: readonly ChatToolCall[] | null;
    readonly toolCallId: string | null;
    readonly createdAt: string;
}

/** 아직 승인을 기다리는 도구 호출의 와이어 표현이다. */
export interface ChatConfirmationDto {
    readonly id: string;
    readonly toolName: string;
    readonly args: Record<string, unknown>;
}

/** 사용자 장기기억 한 줄의 와이어 표현이며 시각은 ISO 문자열이다. */
export interface ChatUserMemoryDto {
    readonly key: string;
    readonly content: string;
    readonly updatedAt: string;
}

export function mapThread(thread: ChatThread): ChatThreadDto {
    return {
        id: thread.id,
        userId: thread.userId,
        title: thread.title,
        summary: thread.summary,
        backend: thread.implementation,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
    };
}

export function mapMessage(message: ChatMessage): ChatMessageDto {
    return {
        id: message.id,
        threadId: message.threadId,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls,
        toolCallId: message.toolCallId,
        createdAt: message.createdAt.toISOString(),
    };
}

export function mapExecution(execution: ChatExecution): ChatExecutionDto {
    return {
        id: execution.id,
        threadId: execution.threadId,
        replayAnchorMessageId: execution.replayAnchorMessageId,
        status: execution.status,
        phase: execution.phase,
        requestedBackend: execution.requestedBackend,
        draftText: execution.draftText,
        draftSeq: execution.draftSeq,
        assistantMessageId: execution.assistantMessageId,
        modelUsed: execution.modelUsed,
        costUsd: execution.costUsd,
        numTurns: execution.numTurns,
        stopReason: execution.stopReason,
        error: execution.error,
        createdAt: execution.createdAt.toISOString(),
        updatedAt: execution.updatedAt.toISOString(),
        startedAt: execution.startedAt?.toISOString() ?? null,
        completedAt: execution.completedAt?.toISOString() ?? null,
    };
}

export function mapMemory(memory: ChatUserMemory): ChatUserMemoryDto {
    return {
        key: memory.key,
        content: memory.content,
        updatedAt: memory.updatedAt.toISOString(),
    };
}
