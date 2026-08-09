import { DomainError } from "@tracer-agent/platform";

/** 대기 중이 아닌 제안을 해소하려 했음을 알린다. */
export class CleanupNotPendingError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "cleanup.not-pending";

    constructor() {
        super("Cleanup suggestion is not pending");
    }
}

/** 제안이 관측한 뒤에 그 태스크에 활동이 있어 수용이 서지 못했음을 알린다. */
export class CleanupStaleError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "cleanup.stale";

    constructor() {
        super("Task has activity since the suggestion observed it");
    }
}
