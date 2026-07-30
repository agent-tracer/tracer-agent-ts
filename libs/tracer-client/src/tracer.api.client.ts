import { fillBody, fillPath, fillQuery, toolBinding } from "./tool.binding.js";
import { TracerApiWindow, type HttpSend } from "./tracer.api.window.js";

/** 한 사용자의 범위 안에서 도구가 부르는 추적 API 한 번이다. */
export interface TracerApiCall {
    readonly toolName: string;
    readonly userId: string;
    readonly args: Readonly<Record<string, unknown>>;
    readonly scopeToken?: string;
}

/** 계약이 선언한 자리로만 추적 API를 부르는 클라이언트이며 성공이면 봉투를 벗긴 본문을 낸다. */
export class TracerApiClient {
    private readonly window: TracerApiWindow;

    constructor(baseUrl: string, send?: HttpSend) {
        this.window = send === undefined ? new TracerApiWindow(baseUrl) : new TracerApiWindow(baseUrl, send);
    }

    call(call: TracerApiCall): Promise<unknown> {
        const binding = toolBinding(call.toolName);
        const body = binding.method === "GET" ? null : fillBody(binding, call.args);
        return this.window.request({
            method: binding.method,
            path: fillPath(binding, call.args),
            userId: call.userId,
            query: fillQuery(binding, call.args),
            ...(body !== null ? { body } : {}),
            ...(call.scopeToken !== undefined ? { scopeToken: call.scopeToken } : {}),
        });
    }
}
