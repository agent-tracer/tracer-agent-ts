import { DomainError } from "@tracer-agent/platform";

/** 모델 설정에 단가를 모르는 값을 쓰려 했음을 알린다. */
export class UnpricedModelError extends DomainError {
    readonly httpStatus = 400;

    readonly code = "validation_error";

    constructor(model: string) {
        super("Invalid request", [{ loc: ["value"], type: "unpriced_model", model }]);
    }
}
