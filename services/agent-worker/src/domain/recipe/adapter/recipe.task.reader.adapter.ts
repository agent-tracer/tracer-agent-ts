import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { RECIPE_ANCHOR } from "~agent-worker/domain/recipe/model/recipe.const.js";
import type {
    RecipeAnchorSnapshot,
    RecipeTaskReaderPort,
} from "~agent-worker/domain/recipe/port/recipe.task.reader.port.js";
import { wireObject, wireText } from "~agent-worker/support/wire.value.js";

/** 태스크는 추적 API의 공개 경로에만 있으므로 이 어댑터는 원장 연결을 들지 않는다. */
export class RecipeTaskReaderAdapter implements RecipeTaskReaderPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async findAnchor(userId: string, taskId: string): Promise<RecipeAnchorSnapshot | null> {
        const task = await this.findTask(userId, taskId);
        if (task === null) return null;
        const origin = wireText(task["origin"]);
        const rootUserTask =
            (origin === null || !RECIPE_ANCHOR.origin.excludes.includes(origin))
            && (wireText(task["parentTaskId"]) === null) === RECIPE_ANCHOR.root.value;
        const status = wireText(task["status"]);
        return {
            scanEligible: rootUserTask && status !== null && RECIPE_ANCHOR.status.oneOf.includes(status),
            sessionScanEligible: rootUserTask,
        };
    }

    async findOwnedTaskIds(userId: string, taskIds: readonly string[]): Promise<readonly string[]> {
        const found = await Promise.all(taskIds.map((taskId) => this.findTask(userId, taskId)));
        return taskIds.filter((_taskId, position) => found[position] !== null);
    }

    private async findTask(userId: string, taskId: string): Promise<Record<string, unknown> | null> {
        const found = await this.tracer.requestOrNull({
            method: "GET",
            path: `/api/v1/tasks/${encodeURIComponent(taskId)}`,
            userId,
        });
        return found === null ? null : wireObject(wireObject(found)["task"]);
    }
}
