import type { MissingActionArgs } from "@tracer-agent/llm";
import { DomainError } from "@tracer-agent/platform";
import { CHAT_TOOL_ARGUMENT_REJECTION } from "~agent-api/domain/chat/model/chat.tool.schema.js";

/** 대화 턴을 실행할 모델 자격이 사용자 설정에 없음을 알린다. */
export class ChatMissingApiKeyError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "chat.llm-key-missing";

    constructor() {
        super("LLM API key is not configured");
    }
}

/** 아직 끝나지 않은 턴이 있는데 새 턴을 접수하면 두 워크플로가 같은 스레드를 나눠 가져 순서가 역전된다. */
export class ChatActiveTurnConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "chat.execution-active-conflict";

    constructor() {
        super("Chat thread already has an active turn");
    }
}

/** 저장된 문장은 다음 턴의 문맥으로 되돌아오므로 실리지 못한 사유를 그대로 알린다. */
export class ChatMemoryRejectedError extends DomainError {
    readonly httpStatus = 400;
    readonly code = "chat.memory-rejected";

    constructor(rejection: string) {
        super("Memory content was rejected", [{ type: rejection }]);
    }
}

export class ChatExecutionIdempotencyConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "chat.execution-idempotency-conflict";

    constructor() {
        super("Client request id was already used with different chat input");
    }
}

/** action 마다 필요한 인자가 다르므로 빠진 자리를 실어 모델이 같은 호출을 고쳐 다시 부를 수 있게 한다. */
export class ChatToolArgumentsMissingError extends DomainError {
    readonly httpStatus = CHAT_TOOL_ARGUMENT_REJECTION.status;
    readonly code = CHAT_TOOL_ARGUMENT_REJECTION.code;

    constructor(missing: MissingActionArgs) {
        super(CHAT_TOOL_ARGUMENT_REJECTION.message, missing);
    }
}
