import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { wireItems, wireNumber, wireObject, wireText } from "~agent-worker/support/wire.value.js";
import { buildTitleContext } from "~agent-worker/domain/title/model/title.context.model.js";
import type {
    TitleTaskContext,
    TitleTaskReaderPort,
} from "~agent-worker/domain/title/port/title.task.reader.port.js";

/** 태스크는 추적 API의 공개 경로에만 있으므로 이 어댑터는 원장 연결을 들지 않는다. */
export class TitleTaskReaderAdapter implements TitleTaskReaderPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async findTaskContext(userId: string, taskId: string): Promise<TitleTaskContext | null> {
        const detail = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            userId,
        });
        if (detail === null) return null;
        const task = wireObject(wireObject(detail)["task"]);
        const workspacePath = wireText(task["workspacePath"]);

        const [timeline, turnPage] = await Promise.all([
            this.tracer.request({
                method: "GET",
                path: `/api/v1/tasks/${encodeURIComponent(taskId)}/timeline`,
                userId,
                query: { order: "asc", limit: 1 },
            }),
            this.tracer.request({
                method: "GET",
                path: `/api/v1/tasks/${encodeURIComponent(taskId)}/turns`,
                userId,
            }),
        ]);
        const totalEventCount = wireNumber(wireObject(timeline)["total"]) ?? 0;
        const context = buildTitleContext(
            {
                title: wireText(task["title"]) ?? "",
                status: wireText(task["status"]) ?? "",
                ...(workspacePath !== null ? { workspacePath } : {}),
            },
            wireItems(turnPage).map((turn) => ({
                turnIndex: wireNumber(turn["turnIndex"]) ?? 0,
                askedText: wireText(turn["askedText"]) ?? "",
                assistantText: wireText(turn["assistantText"]),
            })),
            totalEventCount,
        );
        return { totalEventCount, context };
    }
}
