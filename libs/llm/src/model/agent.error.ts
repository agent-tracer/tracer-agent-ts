import { readContractJson } from "~llm/support/contract.js";
import type { AgentRunObservation } from "./agent.observation.js";
import type { AgentQueryUsage } from "./agent.usage.js";
import type { JobStepPayload } from "./job.step.js";

/** 실행 백엔드를 구현한 언어이며 같은 서브타입을 두 언어가 함께 낼 수도 있다. */
export type ErrorSubtypeEmitter = "typescript" | "python";

/** 재시도해도 같은 자리에서 끝나는 실패인지와, 예약 몫까지 다 써 실패 대신 빈 결과로 착지시킬 실패인지다. */
export interface EmittedErrorSubtype {
    readonly retryable: boolean;
    readonly landsEmpty: boolean;
    readonly emittedBy: readonly ErrorSubtypeEmitter[];
}

/** 공급자 오류 본문이나 정지 이유를 그대로 통과시킨 값이라 이 구현이 이름 짓지 않으며 재시도 판정만 갖는다. */
export interface ProviderErrorSubtypeVerdict {
    readonly retryable: boolean;
}

/** emitted는 구현체가 직접 이름 짓는 닫힌 어휘이고 provider는 공급자가 새 값을 낼 수 있는 열린 목록이다. */
export interface ErrorSubtypeContract {
    readonly emitted: Readonly<Record<string, EmittedErrorSubtype>>;
    readonly provider: Readonly<Record<string, ProviderErrorSubtypeVerdict>>;
}

/** 두 구현체가 함께 읽는 오류 서브타입 판정표이며 값은 계약 저장소가 소유한다. */
export function loadErrorSubtypeContract(): ErrorSubtypeContract {
    return readContractJson<ErrorSubtypeContract>("agent/shared/error.subtypes.json");
}

// 여러 실행기가 같은 문자열을 참조하도록 공급자 원시 값을 이 어휘로 정규화한다.
export const AGENT_ERROR_SUBTYPE = {
    maxTurnsExceeded: "max_turns_exceeded",
    budgetExceeded: "budget_exceeded",
    outputSchemaInvalid: "output_schema_invalid",
    executionError: "agent_execution_error",
    deadlineExceeded: "deadline_exceeded",
    cancelled: "cancelled",
    processError: "process_error",
    invalidRequest: "invalid_request_error",
} as const;

export type AgentErrorSubtype = (typeof AGENT_ERROR_SUBTYPE)[keyof typeof AGENT_ERROR_SUBTYPE];

// 공급자가 붙여 온 이름을 그대로 통과시키는 값이라 이 실행기는 내지 않고 판정만 빌린다.
export const PROVIDER_ERROR_SUBTYPE = {
    authentication: "authentication_error",
    permission: "permission_error",
    billing: "billing_error",
    notFound: "not_found_error",
    unprocessableEntity: "unprocessable_entity_error",
    requestTooLarge: "request_too_large",
    contentFilter: "content_filter",
    refusal: "refusal",
    rateLimit: "rate_limit_error",
    overloaded: "overloaded_error",
} as const;

export type ProviderErrorSubtype = (typeof PROVIDER_ERROR_SUBTYPE)[keyof typeof PROVIDER_ERROR_SUBTYPE];

export type AgentJobErrorCode = "AGENT_FAILED" | "OUTPUT_NOT_JSON" | "OUTPUT_SCHEMA_INVALID";

/** 실패한 시도가 이미 청구한 비용과 궤적과 실제 모델을 그대로 위로 흘려보낸다. */
export interface AgentFailureDetail {
    readonly errorSubtype: string | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly JobStepPayload[];
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
    readonly retryAfterMs: number | null;
    readonly durationMs: number | null;
    readonly observation: AgentRunObservation | null;
}

export class AgentExecutionFailure extends Error {
    readonly errorSubtype: string | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly JobStepPayload[];
    readonly actualModel: string | null;
    readonly providerRequestId: string | null;
    readonly retryAfterMs: number | null;
    readonly durationMs: number | null;
    readonly observation: AgentRunObservation | null;

    constructor(
        readonly label: string,
        readonly code: AgentJobErrorCode,
        message: string,
        detail: Partial<AgentFailureDetail> = {},
    ) {
        super(message);
        this.name = "AgentExecutionFailure";
        this.errorSubtype = detail.errorSubtype ?? null;
        this.usage = detail.usage ?? null;
        this.steps = detail.steps ?? [];
        this.actualModel = detail.actualModel ?? null;
        this.providerRequestId = detail.providerRequestId ?? null;
        this.retryAfterMs = detail.retryAfterMs ?? null;
        this.durationMs = detail.durationMs ?? null;
        this.observation = detail.observation ?? null;
    }
}

const ERROR_SUBTYPE_CONTRACT = loadErrorSubtypeContract();

// 표에 없는 공급자 값은 판정을 내린 적이 없다는 뜻이라 재시도로 떨어뜨린다.
const NON_RETRYABLE_SUBTYPES: ReadonlySet<string> = new Set(
    [...Object.entries(ERROR_SUBTYPE_CONTRACT.emitted), ...Object.entries(ERROR_SUBTYPE_CONTRACT.provider)]
        .filter(([, verdict]) => !verdict.retryable)
        .map(([subtype]) => subtype),
);

export function isNonRetryableSubtype(subtype: string | null): boolean {
    return subtype !== null && NON_RETRYABLE_SUBTYPES.has(subtype);
}

const BUDGET_EXHAUSTED_SUBTYPES: ReadonlySet<string> = new Set(
    Object.entries(ERROR_SUBTYPE_CONTRACT.emitted)
        .filter(([, verdict]) => verdict.landsEmpty)
        .map(([subtype]) => subtype),
);

/** 예약된 몫까지 다 써 실패가 아니라 그때까지의 산출로 착지시켜야 하는 중단인지 본다. */
export function isBudgetExhaustedSubtype(subtype: string | null): boolean {
    return subtype !== null && BUDGET_EXHAUSTED_SUBTYPES.has(subtype);
}

/** 예약된 몫으로도 모델이 턴이나 비용을 다 써버려 빈 출력조차 내지 못한 실패인지 본다. */
export function isBudgetExhaustedFailure(error: unknown): error is AgentExecutionFailure {
    return error instanceof AgentExecutionFailure && isBudgetExhaustedSubtype(error.errorSubtype);
}
