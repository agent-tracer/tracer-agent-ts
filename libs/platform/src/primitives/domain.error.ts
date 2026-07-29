export abstract class DomainError extends Error {

    abstract readonly httpStatus: number;

    abstract readonly code: string;

    readonly details?: unknown;

    constructor(message: string, details?: unknown) {
        super(message);
        this.name = new.target.name;
        if (details !== undefined) {
            this.details = details;
        }
    }
}

/** 단일 엔티티나 도메인 협력의 불변식 위반이며 code는 위반한 규칙의 식별자다. */
export class InvariantViolationError extends DomainError {
    readonly httpStatus: number;

    readonly code: string;

    constructor(code: string, httpStatus = 409) {
        super(code);
        this.code = code;
        this.httpStatus = httpStatus;
    }
}
