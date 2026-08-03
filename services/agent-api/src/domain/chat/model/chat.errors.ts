import { DomainError } from "@tracer-agent/platform";

/** 대화 턴을 실행할 모델 자격이 사용자 설정에 없음을 알린다. */
export class ChatMissingApiKeyError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "chat.llm-key-missing";

    constructor() {
        super("LLM API key is not configured");
    }
}

/** 아직 끝나지 않은 턴이 있는데 새 턴을 접수하면 두 워크플로가 같은 스레드를 나눠 나누어 순서가 역전된다. */
export class ChatActiveTurnConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "chat.execution-active-conflict";

    constructor() {
        super("Chat thread already has an active turn");
    }
}

export class ChatExecutionIdempotencyConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "chat.execution-idempotency-conflict";

    constructor() {
        super("Client request id was already used with different chat input");
    }
}
