import type { ToolHandlers } from "@tracer-agent/llm";
import type { TracerApiClient } from "@tracer-agent/tracer-client";
import { parseChatToolArgs } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
import type { ChatTurnSink } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import { chatRecallToolName } from "./chat.tool.surface.js";
import type { ChatToolCallContext } from "./chat.read.tools.js";
import { telemetered } from "./chat.tool.support.js";

const RECALL_FACTS = chatRecallToolName();

/** 한 턴에서 장기기억 도구가 어느 사용자에 매이고 어디로 갱신 통지를 흘리는지다. */
export interface ChatMemoryToolContext extends ChatToolCallContext {
    readonly sink: ChatTurnSink;
}

/** 확인 게이트를 거치지 않고 곧바로 장기기억을 되읽는 도구를 만든다. */
export function buildChatMemoryToolHandlers(
    client: TracerApiClient,
    ctx: ChatMemoryToolContext,
): ToolHandlers {
    const scope = ctx.scopeToken !== undefined ? { scopeToken: ctx.scopeToken } : {};
    return {
        [RECALL_FACTS]: async (raw) => {
            const args = parseChatToolArgs(RECALL_FACTS, raw);
            return telemetered(RECALL_FACTS, {}, async () =>
                JSON.stringify(await client.call({ toolName: RECALL_FACTS, userId: ctx.userId, args, ...scope })),
            );
        },
    };
}
