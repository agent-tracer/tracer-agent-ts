import { withToolTelemetry } from "@tracer-agent/llm";
import { isApiSuccessEnvelope } from "@tracer-agent/platform";
import { AGENT, MONITOR_USER_HEADER } from "~agent-worker/support/agent.const.js";

const AGENT_NAME = AGENT.chat.id;

export function telemetered<T>(toolName: string, parameters: unknown, run: () => Promise<T>): Promise<T> {
    return withToolTelemetry({ toolName, agentName: AGENT_NAME, parameters }, run);
}

/** 도구가 부르는 창구가 사용자 범위를 밝히는 헤더이며 실행 범위 자격이 있으면 함께 싣는다. */
export function chatApiHeaders(userId: string, scopeToken: string | undefined): Record<string, string> {
    return {
        [MONITOR_USER_HEADER]: userId,
        // 자격이 있으면 서버가 자기신고 헤더 대신 자격이 담은 사용자를 믿는다.
        ...(scopeToken !== undefined && scopeToken.length > 0
            ? { authorization: `Bearer ${scopeToken}` }
            : {}),
    };
}

/** 성공 봉투를 벗겨 모델이 두 구현체에서 같은 필드를 보게 한다. */
export function unwrapChatApiEnvelope(raw: string): string {
    let payload: unknown;
    try {
        payload = JSON.parse(raw);
    } catch {
        return raw;
    }
    return isApiSuccessEnvelope(payload) ? JSON.stringify(payload.data) : raw;
}
