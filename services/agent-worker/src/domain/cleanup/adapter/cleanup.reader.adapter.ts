import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import {
    wireDate,
    wireItems,
    wireNumber,
    wireObject,
    wireText,
    wireTexts,
} from "~agent-worker/support/wire.value.js";
import type {
    CleanupEvent,
    CleanupEventReaderPort,
    CleanupTask,
    CleanupTaskReaderPort,
} from "~agent-worker/domain/cleanup/port/cleanup.reader.port.js";

const TIMELINE_ORDER = { asc: "asc", desc: "desc" } as const;

/** 태스크와 이벤트를 추적 API의 조회 창구에서 cleanup 도구 표현으로 읽는다. */
export class CleanupReaderAdapter implements CleanupTaskReaderPort, CleanupEventReaderPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async findById(userId: string, taskId: string): Promise<CleanupTask | null> {
        const found = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            userId,
        });
        if (found === null) return null;
        return { id: wireText(wireObject(wireObject(found)["task"])["id"]) ?? taskId };
    }

    findTimeline(
        userId: string,
        taskId: string,
        cursor: { readonly seq: string } | undefined,
        limit: number,
    ): Promise<readonly CleanupEvent[]> {
        return this.readTimeline(userId, taskId, TIMELINE_ORDER.asc, cursor?.seq, limit);
    }

    findTimelineWindow(
        userId: string,
        taskId: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly CleanupEvent[]> {
        return this.readTimeline(userId, taskId, TIMELINE_ORDER.desc, cursor, limit);
    }

    async countByTask(userId: string, taskId: string): Promise<number> {
        const page = await this.timeline(userId, taskId, TIMELINE_ORDER.asc, undefined, 1);
        return wireNumber(wireObject(page)["total"]) ?? 0;
    }

    private async readTimeline(
        userId: string,
        taskId: string,
        order: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly CleanupEvent[]> {
        const page = await this.timeline(userId, taskId, order, cursor, limit);
        return wireItems(page).map(toEvent);
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

function toEvent(item: Record<string, unknown>): CleanupEvent {
    return {
        id: wireText(item["id"]) ?? "",
        seq: wireText(item["seq"]) ?? String(wireNumber(item["seq"]) ?? 0),
        kind: wireText(item["kind"]) ?? "",
        title: wireText(item["title"]) ?? "",
        body: wireText(item["body"]),
        toolName: wireText(item["toolName"]),
        filePaths: wireTexts(item["filePaths"]),
        occurredAt: wireDate(item["occurredAt"]),
    };
}
