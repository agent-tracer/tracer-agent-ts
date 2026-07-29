import { withToolTelemetry, type ToolHandlers } from "@tracer-agent/llm";
import { clampInt } from "~agent-worker/support/clamp.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { toTitleEventPage } from "~agent-worker/domain/title/model/title.event.model.js";
import {
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    EVENT_ORDER,
    MAX_EVENT_LIMIT,
    MIN_EVENT_LIMIT,
    TITLE_SUGGESTION_TOOL,
    parseGetTaskEventsArgs,
} from "~agent-worker/domain/title/model/title.tool.schema.js";
import type { TitleEventReaderPort } from "~agent-worker/domain/title/port/title.event.reader.port.js";

const AGENT_NAME = AGENT.titleSuggestion.id;

/** 사용자 범위를 고정한 이 슬라이스 소유의 이벤트 조회 도구 핸들러를 만든다. */
export function buildTitleToolHandlers(userId: string, reader: TitleEventReaderPort): ToolHandlers {
    return {
        [TITLE_SUGGESTION_TOOL.getTaskEvents]: async (raw) => {
            const { taskId, limit, cursor, order } = parseGetTaskEventsArgs(raw);
            return withToolTelemetry(
                {
                    toolName: TITLE_SUGGESTION_TOOL.getTaskEvents,
                    agentName: AGENT_NAME,
                    parameters: { taskId, limit, cursor, order },
                },
                async () => {
                    if (!(await reader.taskExists(userId, taskId))) return `Task ${taskId} not found.`;
                    const size = clampInt(limit, DEFAULT_EVENT_LIMIT, MIN_EVENT_LIMIT, MAX_EVENT_LIMIT);
                    const reading = order ?? DEFAULT_EVENT_ORDER;
                    const [events, total] = await Promise.all([
                        reader.readTimeline({
                            userId,
                            taskId,
                            // 한 줄을 더 읽어야 다음 쪽이 남았는지 알 수 있다.
                            limit: size + 1,
                            descending: reading === EVENT_ORDER.desc,
                            ...(cursor !== undefined ? { cursor } : {}),
                        }),
                        reader.countByTask(userId, taskId),
                    ]);
                    return JSON.stringify(toTitleEventPage(events, size, total));
                },
            );
        },
    };
}
