import type { AgentRunObservation, JobStepPayload } from "@tracer-agent/llm";
import type { ChatExecutionClaim } from "~agent-worker/domain/chat/model/chat.const.js";
import type { ChatExecution, ChatExecutionSpend } from "~agent-worker/domain/chat/model/chat.execution.model.js";
import type { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import type { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";

/** 실행 애그리게이트에 대한 워커의 몫이며 접수의 조회와 삭제는 이 포트에 없다. */
export interface ChatExecutionRepositoryPort {
    findById(id: string): Promise<ChatExecution | null>;
    listQueuedByThread(threadId: string): Promise<ChatExecution[]>;
    claimQueued(id: string, now: Date): Promise<ChatExecutionClaim>;
    /** 갱신이 끊긴 running을 queued로 되돌리며 threadId를 주면 그 스레드만 조회하는다. */
    recoverStaleRunning(idleBefore: Date, now: Date, threadId?: string): Promise<number>;
    beginAttempt(id: string, attempt: number, draftTokenHash: string, now: Date): Promise<boolean>;
    checkpointRunning(
        id: string,
        attempt: number,
        draftText: string,
        draftSeq: number,
        now: Date,
    ): Promise<boolean>;
    completeRunning(
        id: string,
        assistantMessageId: string,
        spend: ChatExecutionSpend,
        now: Date,
    ): Promise<boolean>;
    /** 취소된 실행에 산출물이 아직 없을 때만 붙이며 상태는 취소로 남긴다. */
    recordCanceledOutcome(
        id: string,
        assistantMessageId: string,
        spend: ChatExecutionSpend,
        now: Date,
    ): Promise<boolean>;
    failActive(id: string, error: string, now: Date): Promise<boolean>;
}

/** 스레드 애그리게이트에서 워커가 쓰는 몫이며 생성과 삭제와 목록은 접수의 것이다. */
export interface ChatThreadRepositoryPort {
    findById(id: string): Promise<ChatThread | null>;
    update(thread: ChatThread): Promise<void>;
}

/** 대화 메시지 적재와 스레드별 재생 목록이며 삭제는 접수의 것이다. */
export interface ChatMessageRepositoryPort {
    append(message: ChatMessage): Promise<void>;
    listByThread(threadId: string): Promise<ChatMessage[]>;
}

/** 실행 시도 하나가 남긴 궤적 한 줄이며 식별자는 워커가 붙인다. */
export interface ChatExecutionStepRecord {
    readonly id: string;
    readonly executionId: string;
    readonly userId: string;
    readonly attempt: number;
    readonly step: JobStepPayload;
    readonly now: Date;
}

export interface ChatExecutionStepRepositoryPort {
    insertMany(steps: readonly ChatExecutionStepRecord[]): Promise<void>;
}

/** 실행 관측을 원장에 한 번만 새기며 이미 있으면 거짓을 낸다. */
export interface AgentRunObservationRepositoryPort {
    record(userId: string, observation: AgentRunObservation, now: Date): Promise<boolean>;
}
