export interface ApiSuccessEnvelope<T = unknown> {
    readonly ok: true;
    readonly data: T;
}

export interface ApiErrorEnvelope {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
    };
}

export type ApiResponseEnvelope<T = unknown> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export function createApiSuccessEnvelope(payload: unknown): ApiSuccessEnvelope {
    // 이미 봉투 형태면 중복 포장하지 않는다.
    if (isRecord(payload) && payload["ok"] === true) {
        if ("data" in payload) {
            return payload as unknown as ApiSuccessEnvelope;
        }
        const { ok: _ok, ...data } = payload;
        return { ok: true, data: Object.keys(data).length > 0 ? data : null };
    }
    return { ok: true, data: payload ?? null };
}

export function createApiErrorEnvelope(code: string, message: string, details?: unknown): ApiErrorEnvelope {
    return {
        ok: false,
        error: { code, message, ...(details !== undefined ? { details } : {}) },
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isApiSuccessEnvelope(value: unknown): value is ApiSuccessEnvelope {
    return isRecord(value) && value["ok"] === true && "data" in value;
}

export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
    return isRecord(value)
        && value["ok"] === false
        && isRecord(value["error"])
        && typeof value["error"]["code"] === "string"
        && typeof value["error"]["message"] === "string";
}
