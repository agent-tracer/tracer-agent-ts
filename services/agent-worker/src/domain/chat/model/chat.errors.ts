import { DomainError } from "@tracer-agent/platform";

/** 로컬 CLI 인증이 아닌 실행이 API 키 없이 대화 턴을 실행하려 했음을 알린다. */
export class ChatMissingApiKeyError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "chat.llm-key-missing";

    constructor() {
        super("LLM API key is not configured");
    }
}

/** 벽시계가 아니라 진행이 끊겨 서버가 턴을 접었음을 알린다. */
export class ChatTurnStalledError extends DomainError {
    readonly httpStatus = 504;
    readonly code = "chat.turn-stalled";

    constructor() {
        super("Chat turn stopped making progress");
    }
}

/** 스레드의 running 자리를 다른 실행이 가지고 있어 이번 실행을 아직 시작할 수 없다. */
export class ChatThreadBusyError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "chat.thread-busy";

    constructor(threadId: string) {
        super(`Chat thread ${threadId} is already running another execution`);
    }
}

/** 실행이나 그 스레드가 원장에 없다는 뜻이며 접수 재시도가 이미 지운 것일 수 있다. */
export class ChatExecutionNotFoundError extends DomainError {
    readonly httpStatus = 404;
    readonly code = "chat.execution-not-found";

    constructor(message: string) {
        super(message);
    }
}
