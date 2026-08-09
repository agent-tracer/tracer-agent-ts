import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import type { CleanupTaskArchiverPort } from "~agent-api/domain/cleanup/port/cleanup.task.archiver.port.js";

/** 태스크를 소유한 추적의 조건부 보관 창구를 부르며 거절의 상태와 코드는 그대로 올라간다. */
export class TracerTaskArchiverAdapter implements CleanupTaskArchiverPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async archive(userId: string, taskId: string, ifNoActivitySince: Date | null): Promise<void> {
        await this.tracer.request({
            method: "POST",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}/archive`,
            userId,
            body: { ifNoActivitySince: ifNoActivitySince?.toISOString() ?? null },
        });
    }
}
