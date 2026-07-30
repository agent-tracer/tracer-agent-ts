import { toolBinding, type TracerApiClient } from "@tracer-agent/tracer-client";
import type {
    ChatToolExecutor,
    ChatToolExecutorRegistry,
} from "~agent-api/domain/chat/port/chat.tool.executors.port.js";
import { chatToolCallPlan } from "./chat.tool.call.plan.js";

/** 도구가 부르는 경로가 추적이 아니라 에이전트 서비스 자신의 것인지를 가른다. */
function isAgentOwnedPath(path: string): boolean {
    return path.startsWith("/api/agent/");
}

/** 승인된 쓰기 도구를 계약이 선언한 자리로 부르고, 대화에 남길 문장을 그 응답에서 만든다. */
export function buildChatToolExecutors(
    tracerClient: TracerApiClient,
    agentClient: TracerApiClient,
): ChatToolExecutorRegistry {
    const registry: Record<string, ChatToolExecutor> = {};
    for (const [toolName, plan] of Object.entries(chatToolCallPlan)) {
        const client = isAgentOwnedPath(toolBinding(toolName).path) ? agentClient : tracerClient;
        registry[toolName] = async (userId, args) => {
            const call = plan(args);
            return call.describe(await client.call({ toolName, userId, args: call.args }));
        };
    }
    return registry;
}
