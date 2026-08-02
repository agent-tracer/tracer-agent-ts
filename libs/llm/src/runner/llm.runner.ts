import type { AgentRunObservation } from "~llm/model/agent.observation.js";
import type { AgentQueryUsage } from "~llm/model/agent.usage.js";
import type { JobStepPayload } from "~llm/model/job.step.js";

/** 구조화 출력 검증기의 구조적 표면이며 zod 스키마가 그대로 맞는다. */
export type SafeParsed<T> =
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly message: string } };

export interface OutputSchema<T> {
    safeParse(value: unknown): SafeParsed<T>;
}

export type AgentEffortLevel = "low" | "medium" | "high" | "xhigh" | "max";

/** 언어 모델이 실행 중 부를 수 있는 도구 하나다. */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export type ToolHandlers = Readonly<Record<string, ToolHandler>>;

/** 스트리밍 실행에서 모델이 제안한 도구 호출 한 건이며 args는 모델이 낸 원본 인자다. */
export interface AgentStreamToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

/** 스트리밍 실행에서 도구가 낸 결과이며 toolCallId로 어느 호출의 결과인지 잇는다. */
export interface AgentStreamToolResult {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly content: string;
}

/** 실행이 끝나기 전에 부분 산출을 흘려보내는 싱크이며 호출자가 넘길 때만 러너가 부분 메시지를 켠다. */
export interface AgentStreamSink {
    /** 텍스트가 아직 없어도 모델이 무언가 내보내고 있음을 알리며 멈춤 감시가 이것을 진행으로 센다. */
    onProgress?(): void;
    onAssistantDelta(text: string): void;
    onToolCall(call: AgentStreamToolCall): void;
    onToolResult(result: AgentStreamToolResult): void;
}

export interface AgentQueryRequest<ProviderOptions = undefined> {
    readonly label: string;
    readonly prompt: string;
    readonly systemPrompt: string;
    /** 턴마다 달라지는 지시이며 실행기가 캐시 경계 뒤에 놓아 접두사를 무효로 만들지 않는다. */
    readonly dynamicSystemPrompt?: string;
    readonly allowedTools: readonly string[];
    /** 실행기가 지우는 빌트인 밖에서 이 실행만 추가로 막을 도구다. */
    readonly disallowedTools?: readonly string[];
    readonly jobId?: string;
    /** 관측 시스템 사이에서 같은 실행을 잇는 식별자이며 없는 값은 추측하거나 임시 생성하지 않는다. */
    readonly observation?: AgentQueryObservationContext;
    readonly model: string;
    readonly maxTurns: number;
    readonly maxOutputTokens?: number;
    readonly deadlineMs: number;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly outputSchema?: Record<string, unknown>;
    readonly idempotencyKey?: string;
    readonly parentSignal?: AbortSignal;
    readonly providerOptions?: ProviderOptions;
    readonly effort?: AgentEffortLevel;
    readonly maxBudgetUsd?: number;
    /** 있으면 러너가 부분 메시지를 켜고 실행 중 부분 산출을 이 싱크로 흘려보낸다. */
    readonly stream?: AgentStreamSink;
}

export interface AgentQueryObservationContext {
    readonly executionId?: string;
    readonly attemptId?: string;
    readonly promptVersion?: string;
    readonly toolContractVersion?: string;
}

export interface AgentQueryResult {
    readonly rawOutput: string;
    readonly structuredOutput: unknown;
    readonly durationMs: number;
    readonly numTurns: number | null;
    readonly costUsd: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 성공이든 실패든 그 시점까지의 실행 궤적이다. */
    readonly steps: readonly JobStepPayload[];
    readonly errorSummary: string | null;
    readonly errorSubtype: string | null;
    /** 예산이 다해 조사 도구를 거두고 결론만 받는 마지막 호출로 넘어갔는지다. */
    readonly landed: boolean;
    readonly retryAfterMs?: number | null;
    /** 공급자가 실제로 응답을 만든 모델이며 fallback으로 요청 모델과 달라질 수 있다. */
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
    /** 첫 토큰이 도착하기까지의 밀리초이며 스트리밍으로 받지 않은 실행은 잴 자리가 없어 비운다. */
    readonly ttftMs: number | null;
}

/** 프롬프트를 넣으면 구조화 출력을 내는 공급자 실행기다. */
export interface IQueryRunner<ProviderOptions = undefined> {
    requiresLocalApiKey(): boolean;
    run(request: AgentQueryRequest<ProviderOptions>): Promise<AgentQueryResult>;
}

/** 러너와 무관한 구조화 실행 결과다. */
export interface StructuredAgentResult<T> {
    readonly data: T;
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly JobStepPayload[];
    readonly landed: boolean;
    readonly providerRequestId: string | null;
    readonly observation?: AgentRunObservation;
}

/** 도메인 어휘를 모른 채 구조화 출력을 내는 실행 백엔드 실행기다. */
export interface AgentRunnerPort {
    requiresLocalApiKey(): boolean;
    runStructured<T>(
        agentId: string,
        input: Record<string, unknown>,
        schema: OutputSchema<T>,
        /** attempt는 오케스트레이터가 세는 시도 번호이며 같은 시도의 재개와 새 시도를 가른다. */
        opts: { deadlineMs: number; attempt: number; abortSignal?: AbortSignal },
    ): Promise<StructuredAgentResult<T>>;
}
