import { withToolTelemetry, type MissingActionArgs } from "@tracer-agent/llm";
import { isApiErrorEnvelope, isApiSuccessEnvelope } from "@tracer-agent/platform";
import { CHAT_TOOL_ARGUMENT_REJECTION } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
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

/** 확인 창구가 빠진 인자를 알리며 거절했으면 그 자리를 낸다. */
export function missingArgumentsOf(raw: string): MissingActionArgs | null {
    let payload: unknown;
    try {
        payload = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!isApiErrorEnvelope(payload) || payload.error.code !== CHAT_TOOL_ARGUMENT_REJECTION.code) return null;
    const details = payload.error.details;
    if (typeof details !== "object" || details === null) return null;
    const { action, missing } = details as { action?: unknown; missing?: unknown };
    if (typeof action !== "string" || !Array.isArray(missing)) return null;
    return { action, missing: missing.filter((name): name is string => typeof name === "string") };
}
