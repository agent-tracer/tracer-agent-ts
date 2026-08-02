import { TOOL_BINDINGS, TOOL_GATE_CONFIRM, TOOL_GATE_NONE } from "@tracer-agent/tracer-client";

/** 장기기억을 되읽는 도구는 게이트 없이 곧바로 부르되 원장이 에이전트 서비스에 있어 기점이 다르다. */
export const CHAT_MEMORY_TOOLS = ["recall_facts"] as const;

const MEMORY_TOOL_SET: ReadonlySet<string> = new Set(CHAT_MEMORY_TOOLS);

/** 도구가 부르는 경로가 추적이 아니라 에이전트 서비스 자신의 것인지를 가른다. */
function isAgentOwnedPath(path: string): boolean {
    return path.startsWith("/api/agent/");
}

/** 게이트 없이 되읽는 도구 중 추적 API의 뷰인 도구 이름이다. */
export function chatReadToolNames(): readonly string[] {
    return Object.entries(TOOL_BINDINGS)
        .filter(
            ([name, binding]) =>
                binding.gate === TOOL_GATE_NONE && !MEMORY_TOOL_SET.has(name) && !isAgentOwnedPath(binding.path),
        )
        .map(([name]) => name);
}

/** 게이트 없이 되읽되 원장이 에이전트 서비스에 있어 기점이 다른 도구 이름이다. */
export function chatAgentReadToolNames(): readonly string[] {
    return Object.entries(TOOL_BINDINGS)
        .filter(
            ([name, binding]) =>
                binding.gate === TOOL_GATE_NONE && !MEMORY_TOOL_SET.has(name) && isAgentOwnedPath(binding.path),
        )
        .map(([name]) => name);
}

/** 승인 뒤에야 실제로 부르는 도구 이름이며 이 워커는 확인 대기 행만 세운다. */
export function chatWriteToolNames(): readonly string[] {
    return Object.entries(TOOL_BINDINGS)
        .filter(([, binding]) => binding.gate === TOOL_GATE_CONFIRM)
        .map(([name]) => name);
}
