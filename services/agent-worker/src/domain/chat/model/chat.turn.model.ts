import type {
    AgentAxis,
    AgentQueryUsage,
    AgentRunObservation,
    JobStepPayload,
} from "@tracer-agent/llm";
import type { ChatMessageRole, ChatStopReason } from "./chat.const.js";
import type { ChatMessage, ChatToolCall } from "./chat.message.model.js";

/** 대화 턴에 재생되는 이전 메시지 한 건이며 저장 모델이 아닌 재생용 평문이다. */
export interface ChatTurnMessage {
    readonly role: ChatMessageRole;
    readonly content: string;
    readonly toolCalls?: readonly ChatToolCall[];
    readonly toolCallId?: string;
}

/** 모델이 이번 턴에 제안한 도구 호출이며 어시스턴트 메시지에 그대로 실려 저장된다. */
export interface ChatTurnToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

/** 도구가 이번 턴에 낸 결과이며 toolCallId로 어느 호출의 결과인지 잇는다. */
export interface ChatTurnToolResult {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly content: string;
}

/** 사용자에 대해 모델이 오래 기억하는 사실 한 건이며 key가 재작성 대상을 찾는 안정된 슬러그다. */
export interface ChatUserFact {
    readonly key: string;
    readonly content: string;
}

/** 장기기억 산출물을 서버가 적재한 뒤 사용자에게 알리는 갱신 통지다. */
export interface ChatMemoryUpdate {
    readonly key: string;
    readonly content: string;
}

/** 턴이 끝나기 전에 부분 산출을 전송하는 싱크이며 확인 대기 행은 이 싱크로 흐르지 않는다. */
export interface ChatTurnSink {
    /** 보낼 산출물은 없지만 실행이 나아가고 있음을 알리며 멈춤 감시만 이것을 본다. */
    onProgress?(): void;
    /** Promise를 돌려주면 호출자가 그 완료를 기다려 브라우저 쪽 역압력을 상류로 전한다. */
    onAssistantDelta(text: string): void | Promise<void>;
    onToolCall(call: ChatTurnToolCall): void | Promise<void>;
    onToolResult(result: ChatTurnToolResult): void | Promise<void>;
    /** 장기기억 산출물을 서버가 적재한 뒤 투명성 통지로 전송한다. */
    onMemoryUpdated?(update: ChatMemoryUpdate): void | Promise<void>;
}

/** 한 대화 턴의 실행 입력이다. */
export interface ChatTurnInput {
    readonly idempotencyKey: string;
    readonly threadId: string;
    readonly userId: string;
    readonly language: string;
    /** 이 턴 직전까지 스레드에 쌓인 메시지이며 마지막이 방금 받은 사용자 메시지다. */
    readonly messages: readonly ChatTurnMessage[];
    /** 모든 스레드에 걸쳐 이 사용자에 대해 기억해 둔 사실이며 프롬프트 맨 앞에 주입된다. */
    readonly facts?: readonly ChatUserFact[];
    readonly summary?: string | null;
    readonly model?: string;
    readonly apiKey?: string;
    readonly deadlineMs: number;
    readonly abortSignal?: AbortSignal;
    /** 이 실행 시도의 번호이며 늦게 도착한 낮은 시도의 draft를 서버가 가려내는 기준이다. */
    readonly attempt: number;
    /** 실행이 프로세스 밖에서 draft를 보낼 때 쓰는 1회용 자격이다. */
    readonly draftToken?: string;
    /** 도구가 프로세스 밖에서 API를 부를 때 쓰는, 이 사용자와 이 실행에 매인 자격이다. */
    readonly scopeToken?: string;
}

/** 한 대화 턴의 실행 결과다. */
export interface ChatTurnResult {
    readonly observation: AgentRunObservation;
    readonly text: string;
    readonly backend: AgentAxis;
    readonly toolCalls: readonly ChatTurnToolCall[];
    readonly modelUsed: string;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 모델이 응답을 멈춘 이유이며 완료가 아니면 사용자가 이어서 진행할지 정해야 한다. */
    readonly stopReason: ChatStopReason;
    /** 성공이든 중단이든 그 시점까지의 모델과 도구 궤적이다. */
    readonly steps: readonly JobStepPayload[];
    readonly errorSummary: string | null;
}

/** 저장 모델을 재생용 평문으로 벗겨 내는 유일한 변환이며 재생을 쓰는 모든 유스케이스가 공유한다. */
export function toChatTurnMessage(message: ChatMessage): ChatTurnMessage {
    return {
        role: message.role,
        content: message.content,
        ...(message.toolCalls !== null ? { toolCalls: message.toolCalls } : {}),
        ...(message.toolCallId !== null ? { toolCallId: message.toolCallId } : {}),
    };
}
