import { DomainError } from "@tracer-agent/platform";

/** 대기 중이 아닌 제안을 해소하려 했음을 알린다. */
export class CleanupNotPendingError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "cleanup.not-pending";

    constructor() {
        super("Cleanup suggestion is not pending");
    }
}

/** 태스크를 소유한 추적이 내는 낡음 거절의 어휘이며 이 축은 던지지 않고 계약과 대조하는 자리가 쓴다. */
export class CleanupStaleError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "cleanup.stale";

    constructor() {
        super("Task has activity since the suggestion observed it");
    }
}
