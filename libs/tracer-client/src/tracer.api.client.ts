import { isApiSuccessEnvelope } from "@tracer-agent/platform";
import { fillBody, fillPath, fillQuery, toolBinding } from "./tool.binding.js";
import { tracerApiError } from "./tracer.api.error.js";

/** 요청자를 식별하는 헤더이며 실행 범위 자격이 있으면 추적 API가 이 값을 자격의 것으로 덮는다. */
const USER_HEADER = "x-monitor-user";

/** 한 사용자의 범위 안에서 도구가 부르는 추적 API 한 번이다. */
export interface TracerApiCall {
    readonly toolName: string;
    readonly userId: string;
    readonly args: Readonly<Record<string, unknown>>;
    readonly scopeToken?: string;
}

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

/** 계약이 선언한 자리로만 추적 API를 부르는 클라이언트이며 성공이면 봉투를 벗긴 본문을 낸다. */
export class TracerApiClient {
    private readonly baseUrl: string;

    constructor(baseUrl: string, private readonly send: HttpSend = sendWithFetch) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    async call(call: TracerApiCall): Promise<unknown> {
        const binding = toolBinding(call.toolName);
        const query = new URLSearchParams(fillQuery(binding, call.args)).toString();
        const body = binding.method === "GET" ? null : fillBody(binding, call.args);
        const url = `${this.baseUrl}${fillPath(binding, call.args)}${query.length > 0 ? `?${query}` : ""}`;

        const response = await this.send(url, {
            method: binding.method,
            headers: this.headers(call, body !== null),
            ...(body !== null ? { body: JSON.stringify(body) } : {}),
        });
        const text = await response.text();
        const payload = parseJson(text);
        if (response.status >= 400) throw tracerApiError(response.status, payload, text);
        return isApiSuccessEnvelope(payload) ? payload.data : payload;
    }

    private headers(call: TracerApiCall, hasBody: boolean): Record<string, string> {
        return {
            [USER_HEADER]: call.userId,
            ...(hasBody ? { "content-type": "application/json" } : {}),
            // 자격이 있으면 추적 API가 자기신고 헤더 대신 자격이 담은 사용자를 믿는다.
            ...(call.scopeToken !== undefined ? { authorization: `Bearer ${call.scopeToken}` } : {}),
        };
    }
}

function sendWithFetch(url: string, init: HttpRequestInit): Promise<HttpResponse> {
    return fetch(url, { method: init.method, headers: { ...init.headers }, ...(init.body !== undefined ? { body: init.body } : {}) });
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
