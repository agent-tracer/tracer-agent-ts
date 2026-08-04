import { DomainError, isApiErrorEnvelope } from "@tracer-agent/platform";

/** 추적 API가 거절조차 내지 못하고 실패했을 때 부르는 쪽이 보는 상태다. */
const UPSTREAM_FAILURE_STATUS = 502;

/** 추적 API가 낸 거절이며 상태와 코드를 그대로 실어 부르는 쪽이 다시 분류하지 않게 한다. */
export class TracerApiError extends DomainError {
    readonly httpStatus: number;

    readonly code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.httpStatus = status >= 400 && status < 600 ? status : UPSTREAM_FAILURE_STATUS;
        this.code = code;
    }
}

/** 오류 봉투면 그 코드와 문장을, 아니면 상태만 아는 거절을 만든다. */
export function tracerApiError(status: number, payload: unknown, fallbackText: string): TracerApiError {
    if (isApiErrorEnvelope(payload)) {
        return new TracerApiError(status, payload.error.code, payload.error.message);
    }
    return new TracerApiError(status, "tracer_api_failed", fallbackText);
}
