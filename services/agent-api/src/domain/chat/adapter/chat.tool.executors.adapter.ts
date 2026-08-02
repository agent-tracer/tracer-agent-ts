import { toolBinding, type TracerApiClient } from "@tracer-agent/tracer-client";
import type {
    ChatToolExecutor,
    ChatToolExecutorRegistry,
} from "~agent-api/domain/chat/port/chat.tool.executors.port.js";
import { chatToolCallPlan } from "./chat.tool.call.plan.js";

/** 경로는 도구의 표면을 정하지 않고 그 호출이 어느 상류로 나가는지만 정한다. */
function callsAgentUpstream(path: string): boolean {
    return path.startsWith("/api/agent/");
}

/** 승인된 쓰기 도구를 계약이 선언한 자리로 부르고, 대화에 남길 문장을 그 응답에서 만든다. */
export function buildChatToolExecutors(
    tracerClient: TracerApiClient,
    agentClient: TracerApiClient,
): ChatToolExecutorRegistry {
    const registry: Record<string, ChatToolExecutor> = {};
    for (const [toolName, plan] of Object.entries(chatToolCallPlan)) {
        const client = callsAgentUpstream(toolBinding(toolName).path) ? agentClient : tracerClient;
        registry[toolName] = async (userId, args) => {
            const call = plan(args);
            return call.describe(await client.call({ toolName, userId, args: call.args }));
        };
    }
    return registry;
}
