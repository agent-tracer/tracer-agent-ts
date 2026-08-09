import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import type {
    RecipeTaskReaderPort,
    RecipeTaskTitle,
} from "~agent-api/domain/recipe/port/recipe.task.reader.port.js";

/** 목록 창구 한 장이 담는 최대 개수이며 계약의 tracer.tasks 케이스가 같은 수를 갖는다. */
const MAX_IDS_PER_CALL = 100;

interface TaskItem {
    readonly id?: unknown;
    readonly title?: unknown;
}

/** 인용된 태스크의 제목을 추적의 집합 조회로 읽으며 상한을 넘으면 나눠 부른다. */
export class TracerTaskReaderAdapter implements RecipeTaskReaderPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async findTitlesByIds(userId: string, ids: readonly string[]): Promise<readonly RecipeTaskTitle[]> {
        const found: RecipeTaskTitle[] = [];
        for (const chunk of chunks(ids, MAX_IDS_PER_CALL)) {
            found.push(...(await this.readChunk(userId, chunk)));
        }
        return found;
    }

    private async readChunk(userId: string, ids: readonly string[]): Promise<readonly RecipeTaskTitle[]> {
        const page = await this.tracer.request({
            method: "GET",
            path: "/api/v1/tasks",
            userId,
            query: { ids: ids.join(",") },
        });
        const items = (page as { readonly items?: unknown }).items;
        if (!Array.isArray(items)) return [];
        return items
            .map((item) => item as TaskItem)
            .filter((item): item is { id: string; title: string } =>
                typeof item.id === "string" && typeof item.title === "string")
            .map((item) => ({ id: item.id, title: item.title }));
    }
}

function chunks(ids: readonly string[], size: number): readonly (readonly string[])[] {
    const grouped: string[][] = [];
    for (let index = 0; index < ids.length; index += size) grouped.push(ids.slice(index, index + size));
    return grouped;
}
