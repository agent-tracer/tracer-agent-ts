import { DomainError } from "@tracer-agent/platform";

/** 요청한 실험이 이 사용자의 것이 아니거나 아직 초안이 아님을 알린다. */
export class ExperimentNotFoundError extends DomainError {
    readonly httpStatus = 404;
    readonly code = "evaluation.experiment-not-found";

    constructor(experimentId: string) {
        super("Experiment not found", { experimentId });
    }
}

/** 확인한 그림과 지금의 데이터셋·변형이 달라졌음을 알린다. */
export class ExperimentPreviewChangedError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "evaluation.experiment-preview-changed";

    constructor(experimentId: string) {
        super("Experiment preview changed", { experimentId });
    }
}

/** 다른 요청이 먼저 같은 실험을 시작했음을 알린다. */
export class ExperimentStartConflictError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "evaluation.experiment-already-started";

    constructor(experimentId: string) {
        super("Experiment was already started", { experimentId });
    }
}

/** 요청한 실행이 이 사용자의 실험에 속하지 않음을 알린다. */
export class ExecutionNotFoundError extends DomainError {
    readonly httpStatus = 404;
    readonly code = "evaluation.execution-not-found";

    constructor(executionId: string) {
        super("Evaluation execution not found", { executionId });
    }
}

/** 정산하거나 돌려놓으려는 시도가 원장이 아는 시도와 어긋남을 알린다. */
export class ExecutionAttemptMismatchError extends DomainError {
    readonly httpStatus = 409;
    readonly code = "evaluation.execution-attempt-mismatch";

    constructor(executionId: string, attempt: number, known: number) {
        super("Evaluation execution attempt does not match the ledger", { executionId, attempt, known });
    }
}
