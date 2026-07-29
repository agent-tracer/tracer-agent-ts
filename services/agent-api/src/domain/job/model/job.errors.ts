import { DomainError } from "@tracer-agent/platform";

/** 모델 자격이 없어 원격 실행 잡을 만들 수 없음을 알린다. */
export class LlmKeyMissingError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "job.llm-key-missing";

    constructor() {
        super("LLM API key is not configured");
    }
}

/** 같은 멱등키를 서로 다른 요청 본문으로 재사용했음을 알린다. */
export class JobIdempotencyConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "job.idempotency-conflict";

    constructor() {
        super("Idempotency key was already used with different job input");
    }
}

/** 규칙 생성의 근거가 요청 사용자의 태스크에 속한 사용자 발화가 아님을 알린다. */
export class InvalidRuleAnchorError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "job.invalid-rule-anchor";

    constructor() {
        super("Rule generation requires an owned user-message anchor");
    }
}
