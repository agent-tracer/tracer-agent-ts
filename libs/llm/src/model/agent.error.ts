import { readContractJson } from "~llm/support/contract.js";
import type { AgentAxis } from "./agent.axis.js";
import type { AgentRunObservation } from "./agent.observation.js";
import type { AgentQueryUsage } from "./agent.usage.js";
import type { JobStepPayload } from "./job.step.js";

/** 재시도해도 같은 자리에서 끝나는 실패인지와, 예약 몫까지 다 써 실패 대신 빈 결과로 종료시킬 실패인지다. */
export interface ErrorSubtypeClass {
    readonly retryable: boolean;
    readonly landsEmpty: boolean;
    readonly subtypes: readonly string[];
}

/** 공급자 오류 본문이나 정지 이유를 그대로 통과시킨 값이라 이 구현이 이름 짓지 않으며 재시도 판정만 갖는다. */
export interface ProviderErrorSubtypeVerdict {
    readonly retryable: boolean;
}

/** classes는 실행 실패의 상위 분류 셋이고 emittedBy는 어느 구현체가 그 하위를 내는지의 기록이다. */
export interface ErrorSubtypeContract {
    readonly classes: Readonly<Record<string, ErrorSubtypeClass>>;
    readonly emittedBy: Readonly<Record<string, readonly AgentAxis[]>>;
    readonly provider: Readonly<Record<string, ProviderErrorSubtypeVerdict>>;
}

/** 상위 분류가 거느린 하위 종류를 판정과 함께 나열한다. */
export function flattenErrorSubtypeClasses(
    contract: ErrorSubtypeContract,
): readonly (ErrorSubtypeClass & { readonly subtype: string })[] {
    return Object.values(contract.classes).flatMap((verdict) =>
        verdict.subtypes.map((subtype) => ({ ...verdict, subtype })),
    );
}

/** 두 구현체가 함께 읽는 오류 서브타입 판정표이며 값은 계약 저장소가 소유한다. */
export function loadErrorSubtypeContract(): ErrorSubtypeContract {
    return readContractJson<ErrorSubtypeContract>("agent/shared/error.subtypes.json");
}

// 여러 실행기가 같은 문자열을 참조하도록 공급자 원시 값을 이 어휘로 정규화한다.
export const AGENT_ERROR_SUBTYPE = {
    maxTurnsExceeded: "max_turns_exceeded",
    budgetExceeded: "budget_exceeded",
    maxTokens: "max_tokens",
    outputSchemaInvalid: "output_schema_invalid",
    executionError: "agent_execution_error",
    deadlineExceeded: "deadline_exceeded",
    cancelled: "cancelled",
    processError: "process_error",
    invalidRequest: "invalid_request_error",
} as const;

export type AgentErrorSubtype = (typeof AGENT_ERROR_SUBTYPE)[keyof typeof AGENT_ERROR_SUBTYPE];

// 공급자가 붙여 온 이름을 그대로 통과시키는 값이라 이 실행기는 내지 않고 판정만 받는다.
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

/** 실패한 시도가 이미 청구한 비용과 궤적과 실제 모델을 그대로 위로 전송한다. */
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

const CLASSIFIED_SUBTYPES = flattenErrorSubtypeClasses(ERROR_SUBTYPE_CONTRACT);

// 표에 없는 공급자 값은 판정을 내린 적이 없다는 뜻이라 재시도로 낮춘다.
const NON_RETRYABLE_SUBTYPES: ReadonlySet<string> = new Set(
    [
        ...CLASSIFIED_SUBTYPES,
        ...Object.entries(ERROR_SUBTYPE_CONTRACT.provider).map(([subtype, verdict]) => ({
            subtype,
            ...verdict,
        })),
    ]
        .filter((verdict) => !verdict.retryable)
        .map((verdict) => verdict.subtype),
);

/** 명시적으로 재시도 가능하다고 분류된 하위 종류이며 판정이 없는 값은 여기 들어오지 않는다. */
const RETRYABLE_SUBTYPES: ReadonlySet<string> = new Set(
    [
        ...CLASSIFIED_SUBTYPES,
        ...Object.entries(ERROR_SUBTYPE_CONTRACT.provider).map(([subtype, verdict]) => ({
            subtype,
            ...verdict,
        })),
    ]
        .filter((verdict) => verdict.retryable)
        .map((verdict) => verdict.subtype),
);

/** 실행기가 같은 자리에서 다시 부를 수 있는 실패인지 답하며 판정이 없는 값은 다시 부르지 않는다. */
export function isRetryableSubtype(subtype: string | null): boolean {
    return subtype !== null && RETRYABLE_SUBTYPES.has(subtype);
}

export function isNonRetryableSubtype(subtype: string | null): boolean {
    return subtype !== null && NON_RETRYABLE_SUBTYPES.has(subtype);
}

const BUDGET_EXHAUSTED_SUBTYPES: ReadonlySet<string> = new Set(
    CLASSIFIED_SUBTYPES.filter((verdict) => verdict.landsEmpty).map((verdict) => verdict.subtype),
);

/** 예약된 몫까지 다 써 실패가 아니라 그때까지의 산출로 종료시켜야 하는 중단인지 본다. */
export function isBudgetExhaustedSubtype(subtype: string | null): boolean {
    return subtype !== null && BUDGET_EXHAUSTED_SUBTYPES.has(subtype);
}

/** 단가를 모르는 모델이라 이 실행의 예산을 집행할 수 없다. */
export class UnpricedModelError extends Error {
    constructor(
        readonly label: string,
        readonly model: string,
    ) {
        super(`${label} cannot enforce its budget for model ${model}`);
        this.name = "UnpricedModelError";
    }
}

/** 예약된 몫으로도 모델이 턴이나 비용을 다 써버려 빈 출력조차 내지 못한 실패인지 본다. */
export function isBudgetExhaustedFailure(error: unknown): error is AgentExecutionFailure {
    return error instanceof AgentExecutionFailure && isBudgetExhaustedSubtype(error.errorSubtype);
}
