import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { wireItems, wireNumber, wireObject, wireText, wireTexts } from "~agent-worker/support/wire.value.js";
import type { TitleSlimEvent } from "~agent-worker/domain/title/model/title.event.model.js";
import type {
    TitleEventReaderPort,
    TitleTimelineQuery,
} from "~agent-worker/domain/title/port/title.event.reader.port.js";

const TIMELINE_ORDER = { asc: "asc", desc: "desc" } as const;

/** 추적 API의 조회 창구에서 태스크 이벤트를 근거로 읽는다. */
export class TitleEventReaderAdapter implements TitleEventReaderPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async taskExists(userId: string, taskId: string): Promise<boolean> {
        const found = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            userId,
        });
        return found !== null;
    }

    async readTimeline(query: TitleTimelineQuery): Promise<readonly TitleSlimEvent[]> {
        const page = await this.timeline(
            query.userId,
            query.taskId,
            query.descending ? TIMELINE_ORDER.desc : TIMELINE_ORDER.asc,
            query.cursor,
            query.limit,
        );
        return wireItems(page).map(toSlimEvent);
    }

    async countByTask(userId: string, taskId: string): Promise<number> {
        const page = await this.timeline(userId, taskId, TIMELINE_ORDER.asc, undefined, 1);
        return wireNumber(wireObject(page)["total"]) ?? 0;
    }

    private timeline(
        userId: string,
        taskId: string,
        order: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<unknown> {
        return this.tracer.request({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}/timeline`,
            userId,
            query: { order, limit, ...(cursor !== undefined ? { cursor } : {}) },
        });
    }
}

function toSlimEvent(item: Record<string, unknown>): TitleSlimEvent {
    const body = wireText(item["body"]);
    const toolName = wireText(item["toolName"]);
    const seq = wireText(item["seq"]) ?? wireNumber(item["seq"]);
    return {
        id: wireText(item["id"]) ?? "",
        seq: seq === null ? "" : String(seq),
        kind: wireText(item["kind"]) ?? "",
        title: wireText(item["title"]) ?? "",
        ...(body !== null ? { body } : {}),
        ...(toolName !== null ? { toolName } : {}),
        filePaths: wireTexts(item["filePaths"]),
        occurredAt: wireText(item["occurredAt"]) ?? "",
    };
}
