import { TOOL_SURFACE, type ToolSurface } from "@tracer-agent/llm";
import { CHAT_TOOL_CONTRACT } from "~agent-worker/domain/chat/model/chat.tool.schema.js";

/** 계약이 그 표면으로 연 도구의 이름을 선언 순서로 낸다. */
function toolNamesOn(surface: ToolSurface): readonly string[] {
    return Object.entries(CHAT_TOOL_CONTRACT.tools)
        .filter(([, tool]) => tool.surface === surface)
        .map(([name]) => name);
}

/** 확인 없이 추적 API를 되읽는 도구 이름이다. */
export function chatReadToolNames(): readonly string[] {
    return toolNamesOn(TOOL_SURFACE.read);
}

/** 확인 없이 되읽되 원장이 에이전트 서비스에 있어 기점이 다른 도구 이름이다. */
export function chatAgentReadToolNames(): readonly string[] {
    return toolNamesOn(TOOL_SURFACE.agentRead);
}

/** 확인 없이 사용자 기억을 되읽는 도구 이름이다. */
export function chatMemoryToolNames(): readonly string[] {
    return toolNamesOn(TOOL_SURFACE.memory);
}

/** 기억을 되읽는 도구 하나의 이름이며 계약이 그 표면을 열지 않았으면 거절한다. */
export function chatRecallToolName(): string {
    const [name] = chatMemoryToolNames();
    if (name === undefined) throw new Error("contract declares no memory surface tool");
    return name;
}

/** 승인 뒤에야 실제로 부르는 도구 이름이며 이 워커는 확인 대기 행만 세운다. */
export function chatWriteToolNames(): readonly string[] {
    return toolNamesOn(TOOL_SURFACE.confirm);
}
