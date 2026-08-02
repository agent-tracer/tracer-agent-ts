import type { ToolHandlers } from "@tracer-agent/llm";
import type { TracerApiClient } from "@tracer-agent/tracer-client";
import { parseChatToolArgs } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
import { chatReadToolNames } from "./chat.tool.surface.js";
import { telemetered } from "./chat.tool.support.js";

/** 한 사용자 범위로 묶인 도구 호출 한 건이다. */
export interface ChatToolCallContext {
    readonly userId: string;
    readonly scopeToken: string | undefined;
}

/** 계약이 선언한 자리로만 되읽는 읽기 도구를 세우며 이름을 주지 않으면 추적 API의 도구를 세운다. */
export function buildChatReadToolHandlers(
    client: TracerApiClient,
    ctx: ChatToolCallContext,
    names: readonly string[] = chatReadToolNames(),
): ToolHandlers {
    const handlers: Record<string, (raw: Record<string, unknown>) => Promise<string>> = {};
    for (const name of names) {
        handlers[name] = async (raw) => {
            const args = parseChatToolArgs(name, raw);
            return telemetered(name, args, async () => {
                const data = await client.call({
                    toolName: name,
                    userId: ctx.userId,
                    args,
                    ...(ctx.scopeToken !== undefined ? { scopeToken: ctx.scopeToken } : {}),
                });
                return JSON.stringify(data);
            });
        };
    }
    return handlers;
}
