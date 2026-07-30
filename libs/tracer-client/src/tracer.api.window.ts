import { isApiSuccessEnvelope } from "@tracer-agent/platform";
import { tracerApiError } from "./tracer.api.error.js";

/** 요청자를 식별하는 헤더이며 실행 범위 자격이 있으면 추적 API가 이 값을 자격의 것으로 덮는다. */
export const TRACER_USER_HEADER = "x-monitor-user";

/** 존재하지 않거나 남의 것인 자원에 추적 API가 내는 상태다. */
const NOT_FOUND_STATUS = 404;

/** 응답 코드를 주는 최소 계약이며 전역 fetch가 이 모양을 만족한다. */
export type HttpSend = (url: string, init: HttpRequestInit) => Promise<HttpResponse>;

export interface HttpRequestInit {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
}

export interface HttpResponse {
    readonly status: number;
    text(): Promise<string>;
}

/** 추적 API 한 자리를 부르는 요청이며 값이 없는 쿼리는 실리지 않는다. */
export interface TracerApiRequest {
    readonly method: string;
    readonly path: string;
    readonly userId: string;
    readonly query?: Readonly<Record<string, string | number | undefined>>;
    readonly body?: unknown;
    readonly scopeToken?: string;
}

/** 추적 API의 공개 창구를 부르고 성공이면 봉투를 벗긴 본문을 내는 전송이다. */
export class TracerApiWindow {
    private readonly baseUrl: string;

    constructor(baseUrl: string, private readonly send: HttpSend = sendWithFetch) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    async request(request: TracerApiRequest): Promise<unknown> {
        const query = buildQuery(request.query);
        const url = `${this.baseUrl}${request.path}${query.length > 0 ? `?${query}` : ""}`;
        const hasBody = request.body !== undefined;
        const response = await this.send(url, {
            method: request.method,
            headers: {
                [TRACER_USER_HEADER]: request.userId,
                ...(hasBody ? { "content-type": "application/json" } : {}),
                ...(request.scopeToken !== undefined ? { authorization: `Bearer ${request.scopeToken}` } : {}),
            },
            ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
        });
        const text = await response.text();
        const payload = parseJson(text);
        if (response.status >= 400) throw tracerApiError(response.status, payload, text);
        return isApiSuccessEnvelope(payload) ? payload.data : payload;
    }

    /** 자원이 없거나 남의 것이면 null을 내며 그 밖의 거절은 그대로 올린다. */
    async requestOrNull(request: TracerApiRequest): Promise<unknown> {
        try {
            return await this.request(request);
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
    }
}

function isNotFound(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        (error as { readonly httpStatus?: unknown }).httpStatus === NOT_FOUND_STATUS
    );
}

function buildQuery(query: Readonly<Record<string, string | number | undefined>> | undefined): string {
    if (query === undefined) return "";
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) {
        if (value !== undefined) params.set(name, String(value));
    }
    return params.toString();
}

export function sendWithFetch(url: string, init: HttpRequestInit): Promise<HttpResponse> {
    return fetch(url, {
        method: init.method,
        headers: { ...init.headers },
        ...(init.body !== undefined ? { body: init.body } : {}),
    });
}

export function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
