/** 평가 실행 배선이 아직 없는 에이전트로 평가 실행이 들어온 실패다. */
export class EvaluationAgentUnsupportedError extends Error {
    constructor(agentName: string) {
        super(`Evaluation execution does not support agent: ${agentName}`);
        this.name = "EvaluationAgentUnsupportedError";
    }
}

/** example.input에 그 에이전트가 요구하는 필드가 없어 재시도로 풀리지 않는 실패다. */
export class EvaluationInputMissingFieldError extends Error {
    constructor(field: string) {
        super(`evaluation example input is missing required field: ${field}`);
        this.name = "EvaluationInputMissingFieldError";
    }
}

/** 이 실행이 구독 인증을 쓸 수 없는데 실행 봉투에 apiKey가 없는 실패다. */
export class EvaluationMissingApiKeyError extends Error {
    constructor() {
        super("Claude SDK evaluation run requires an apiKey in the envelope on non-local profiles.");
        this.name = "EvaluationMissingApiKeyError";
    }
}

const NON_RETRYABLE_ERRORS = [
    EvaluationAgentUnsupportedError,
    EvaluationInputMissingFieldError,
    EvaluationMissingApiKeyError,
] as const;

/** 재시도가 상태를 바꾸지 못하는 실패를 가른다. */
export function isNonRetryableEvaluationError(err: unknown): boolean {
    return NON_RETRYABLE_ERRORS.some((type) => err instanceof type);
}
