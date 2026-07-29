/** 도구가 기록을 읽고 되돌려 보내는 추적 API의 기점이다. */
export function resolveTracerApiUrl(): string {
    return process.env["TRACER_API_URL"] ?? "http://127.0.0.1:3902";
}

/** 재생과 확인 대기와 장기기억이 되돌아오는 에이전트 API의 기점이다. */
export function resolveAgentApiUrl(port: number): string {
    return process.env["AGENT_API_URL"] ?? `http://127.0.0.1:${port}`;
}
