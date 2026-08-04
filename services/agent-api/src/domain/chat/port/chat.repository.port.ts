import type { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import type { ChatExecutionStep } from "~agent-api/domain/chat/model/chat.execution.step.model.js";
import type { ChatMessage } from "~agent-api/domain/chat/model/chat.message.model.js";
import type { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import type { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import type { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";

export const CHAT_THREAD_REPOSITORY = Symbol("ChatThreadRepository");
export const CHAT_MESSAGE_REPOSITORY = Symbol("ChatMessageRepository");
export const CHAT_PENDING_TOOL_REPOSITORY = Symbol("ChatPendingToolRepository");
export const CHAT_USER_MEMORY_REPOSITORY = Symbol("ChatUserMemoryRepository");
export const CHAT_EXECUTION_REPOSITORY = Symbol("ChatExecutionRepository");
export const CHAT_EXECUTION_STEP_REPOSITORY = Symbol("ChatExecutionStepRepository");

/** 대화 스레드 애그리게이트의 저장과 조회를 제공하는 포트다. */
export interface ChatThreadRepositoryPort {
    create(thread: ChatThread): Promise<void>;
    findById(id: string): Promise<ChatThread | null>;
    listByUser(userId: string, limit?: number): Promise<ChatThread[]>;
    update(thread: ChatThread): Promise<void>;
    deleteById(id: string): Promise<void>;
}

/** 대화 메시지의 적재와 스레드별 재생을 제공하는 포트다. */
export interface ChatMessageRepositoryPort {
    append(message: ChatMessage): Promise<void>;
    findById(id: string): Promise<ChatMessage | null>;
    listByThread(threadId: string): Promise<ChatMessage[]>;
    deleteByThread(threadId: string): Promise<void>;
}

/** 대화 턴 실행 원장의 접수와 조회와 종결을 제공하는 포트다. */
export interface ChatExecutionRepositoryPort {
    findById(id: string): Promise<ChatExecution | null>;
    findByIdempotency(
        userId: string,
        threadId: string,
        clientRequestId: string,
    ): Promise<ChatExecution | null>;
    findLatestActiveByThread(threadId: string): Promise<ChatExecution | null>;
    listActive(): Promise<ChatExecution[]>;
    listByThread(threadId: string, limit?: number): Promise<ChatExecution[]>;
    /** 갱신이 끊긴 running을 queued로 되돌리며, threadId를 주면 그 스레드만 조회한다. */
    recoverStaleRunning(idleBefore: Date, now: Date, threadId?: string): Promise<number>;
    checkpointRunning(
        id: string,
        attempt: number,
        draftText: string,
        draftSeq: number,
        now: Date,
    ): Promise<boolean>;
    cancelActive(id: string, now: Date): Promise<boolean>;
    insert(execution: ChatExecution): Promise<void>;
    deleteByThread(threadId: string): Promise<void>;
}

/** 쓰기 도구가 확인을 기다리며 세워 두는 대기 도구 행의 저장과 조회를 제공하는 포트다. */
export interface ChatPendingToolRepositoryPort {
    create(pendingTool: ChatPendingTool): Promise<void>;
    findById(id: string): Promise<ChatPendingTool | null>;
    listByThread(threadId: string): Promise<ChatPendingTool[]>;
    resolve(pendingTool: ChatPendingTool): Promise<void>;
    deleteByThread(threadId: string): Promise<void>;
}

/** 사용자 장기기억의 upsert와 사용자별 조회를 제공하는 포트다. */
export interface ChatUserMemoryRepositoryPort {
    upsert(memory: ChatUserMemory): Promise<void>;
    listByUser(userId: string): Promise<ChatUserMemory[]>;
}

/** 대화 턴이 남긴 궤적의 조회와 삭제를 제공하는 포트다. */
export interface ChatExecutionStepRepositoryPort {
    findByExecutionId(executionId: string, userId: string): Promise<ChatExecutionStep[]>;
    deleteByExecutionIds(executionIds: readonly string[]): Promise<void>;
}
