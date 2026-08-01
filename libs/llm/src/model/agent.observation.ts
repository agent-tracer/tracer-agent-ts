import type { AgentAxis } from "./agent.axis.js";

/** 실행 결과를 저장하고 비교할 때 쓰는, 원문 payload와 비밀은 담지 않는 프레임워크 무관 관측 어휘다. */
export const AGENT_RUN_OBSERVATION_STATUS = {
    succeeded: "succeeded",
    failed: "failed",
    cancelled: "cancelled",
} as const;

export type AgentRunObservationStatus =
    (typeof AGENT_RUN_OBSERVATION_STATUS)[keyof typeof AGENT_RUN_OBSERVATION_STATUS];

export const AGENT_CALL_STATUS = {
    succeeded: "succeeded",
    failed: "failed",
    cancelled: "cancelled",
} as const;

export type AgentCallStatus = (typeof AGENT_CALL_STATUS)[keyof typeof AGENT_CALL_STATUS];

/** 공급자가 보고한 토큰 사용량이며 cache write는 공급자의 cache creation과 같은 뜻이다. */
export interface AgentUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheWriteTokens: number;
}

/** 한 논리 실행 안에서 재시도 한 번을 구별하는 식별자 묶음이다. */
export interface AgentAttemptIdentity {
    readonly executionId: string;
    readonly attemptId: string;
}

/** 공급자 모델 호출 한 번의 비교 가능한 종결 요약이다. */
export interface ModelCallObservation extends AgentAttemptIdentity {
    readonly modelCallId: string;
    readonly providerRequestId: string | null;
    readonly modelRequested: string;
    readonly modelActual: string | null;
    readonly status: AgentCallStatus;
    readonly durationMs: number;
    readonly usage: AgentUsage;
    readonly costUsd: number | null;
    readonly finishReason: string | null;
    readonly errorType: string | null;
}

/** 도구 호출의 인자와 결과를 제외한 종결 요약이다. */
export interface ToolCallObservation extends AgentAttemptIdentity {
    readonly toolCallId: string;
    readonly toolName: string;
    readonly status: AgentCallStatus;
    readonly durationMs: number;
    readonly errorType: string | null;
}

/** 결정적 검증 결과의 요약이며 오류 코드는 원문 오류 메시지를 대신한다. */
export interface ValidationObservation {
    readonly passed: boolean;
    readonly errorCodes: readonly string[];
    readonly citationPrecision: number | null;
    readonly citationRecall: number | null;
}

/** 운영 잡과 실험 실행을 동일한 기준으로 비교하는 정규화된 실행 관측 레코드다. */
export interface AgentRunObservation extends AgentAttemptIdentity {
    readonly jobId: string | null;
    readonly agentName: string;
    readonly backend: AgentAxis;
    readonly modelRequested: string;
    readonly modelActual: string | null;
    readonly promptVersion: string;
    readonly toolContractVersion: string;
    readonly status: AgentRunObservationStatus;
    readonly durationMs: number;
    readonly usage: AgentUsage;
    readonly costUsd: number | null;
    readonly landed: boolean;
    readonly repairAttempted: boolean;
    readonly validation: ValidationObservation;
    readonly modelCalls: readonly ModelCallObservation[];
    readonly toolCalls: readonly ToolCallObservation[];
}
