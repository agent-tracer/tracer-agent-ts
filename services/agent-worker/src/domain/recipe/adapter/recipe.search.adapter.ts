import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { wireItems, wireNumber, wireObject, wireText, wireTexts } from "~agent-worker/support/wire.value.js";
import type { RecipeSearchEvent } from "~agent-worker/domain/recipe/model/recipe.event.model.js";
import type {
    RecipeEventSearchPage,
    RecipeEventSearchQuery,
    RecipeSearchPort,
    RecipeSlimRecipe,
    RecipeSlimTask,
} from "~agent-worker/domain/recipe/port/recipe.search.port.js";

/** 검색 결과에 접혀 오는 메모 히트를 가리는 표식이며 값은 추적 API가 소유한다. */
const MEMO_HIT_TYPE = "memo";

/** 사건과 태스크는 추적이 소유하고 레시피는 이 축이 소유하므로 창구를 나눠 부른다. */
export class RecipeSearchAdapter implements RecipeSearchPort {
    constructor(
        private readonly tracer: TracerApiWindow,
        private readonly agent: TracerApiWindow,
    ) {}

    async searchEvents(userId: string, query: RecipeEventSearchQuery): Promise<RecipeEventSearchPage> {
        const found = await this.tracer.request({
            method: "GET",
            path: "/api/v1/events/search",
            userId,
            query: {
                q: query.q,
                limit: query.limit + 1,
                ...(query.offset > 0 ? { offset: query.offset } : {}),
                ...(query.taskId !== undefined ? { taskId: query.taskId } : {}),
                ...(query.kind !== undefined ? { kind: query.kind } : {}),
                ...(query.toolName !== undefined ? { toolName: query.toolName } : {}),
            },
        });
        const hits = wireItems(found).filter((item) => item["hitType"] !== MEMO_HIT_TYPE);
        const truncated = hits.length > query.limit;
        const events = (truncated ? hits.slice(0, query.limit) : hits).map(toSearchEvent);
        return { events, truncated, total: wireNumber(wireObject(found)["total"]) ?? events.length };
    }

    async searchTasks(userId: string, q: string, limit: number): Promise<readonly RecipeSlimTask[]> {
        const found = await this.tracer.request({
            method: "GET",
            path: "/api/v1/tasks/search",
            userId,
            query: { q, limit },
        });
        return wireItems(found)
            .filter((item) => item["hitType"] !== MEMO_HIT_TYPE)
            .map(toSlimTask);
    }

    async searchRecipes(userId: string, q: string, limit: number): Promise<readonly RecipeSlimRecipe[]> {
        const found = await this.agent.request({
            method: "GET",
            path: "/api/agent/recipes/search",
            userId,
            query: { q, limit },
        });
        return wireItems(found).map(toSlimRecipe);
    }
}

function toSearchEvent(item: Record<string, unknown>): RecipeSearchEvent {
    const body = wireText(item["body"]);
    const toolName = wireText(item["toolName"]);
    const seq = wireText(item["seq"]) ?? wireNumber(item["seq"]);
    return {
        id: wireText(item["id"]) ?? "",
        taskId: wireText(item["taskId"]) ?? "",
        seq: seq === null ? "" : String(seq),
        kind: wireText(item["kind"]) ?? "",
        title: wireText(item["title"]) ?? "",
        ...(body !== null ? { body } : {}),
        ...(toolName !== null ? { toolName } : {}),
        filePaths: wireTexts(item["filePaths"]),
        occurredAt: wireText(item["occurredAt"]) ?? "",
    };
}

function toSlimTask(item: Record<string, unknown>): RecipeSlimTask {
    const taskKind = wireText(item["taskKind"]);
    const updatedAt = wireText(item["updatedAt"]);
    return {
        id: wireText(item["taskId"]) ?? wireText(item["id"]) ?? "",
        title: wireText(item["title"]) ?? "",
        status: wireText(item["status"]) ?? "",
        ...(taskKind !== null ? { taskKind } : {}),
        ...(updatedAt !== null ? { updatedAt } : {}),
    };
}

function toSlimRecipe(item: Record<string, unknown>): RecipeSlimRecipe {
    const rev = wireNumber(item["rev"]);
    const updatedAt = wireText(item["updatedAt"]);
    return {
        id: wireText(item["recipeId"]) ?? wireText(item["id"]) ?? "",
        title: wireText(item["title"]) ?? "",
        intent: wireText(item["intent"]) ?? "",
        status: wireText(item["status"]) ?? "",
        userEdited: item["userEdited"] === true,
        ...(rev !== null ? { rev } : {}),
        ...(updatedAt !== null ? { updatedAt } : {}),
    };
}
