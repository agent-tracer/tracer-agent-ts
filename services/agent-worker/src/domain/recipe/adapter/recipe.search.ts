import { clampInt } from "~agent-worker/support/clamp.js";
import type { RecipeSearchEvent } from "~agent-worker/domain/recipe/model/recipe.event.model.js";
import type { ProvenanceLedger } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import {
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SIMILAR_TASK_LIMIT,
    MAX_SEARCH_LIMIT,
    MAX_SEARCH_OFFSET,
    MAX_SIMILAR_TASK_LIMIT,
} from "~agent-worker/domain/recipe/model/recipe.tool.schema.js";
import type { RecipeSearchClient } from "~agent-worker/domain/recipe/port/recipe.search.port.js";
import type { RecipeTaskReaderPort } from "~agent-worker/domain/recipe/port/recipe.reader.port.js";

export interface SlimTask {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind?: string;
    readonly updatedAt?: string;
}
export interface SlimRecipe {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly status: string;
    readonly userEdited: boolean;
    readonly rev?: number;
    readonly updatedAt?: string;
}
export interface SearchEventsInput {
    readonly q: string;
    readonly taskId?: string;
    readonly kind?: string;
    readonly toolName?: string;
}
export interface SearchEventsPage {
    readonly events: readonly RecipeSearchEvent[];
    readonly truncated: boolean;
    readonly total: number;
}
interface SearchHit {
    readonly _id?: string;
    readonly _source?: Record<string, unknown>;
}
interface SearchResponseBody {
    readonly hits?: { readonly total?: number | { readonly value?: number }; readonly hits?: readonly SearchHit[] };
}

export async function searchEvents(
    search: RecipeSearchClient,
    userId: string,
    input: SearchEventsInput,
    limit: number,
    offset: number,
    ledger: ProvenanceLedger,
): Promise<SearchEventsPage> {
    const filter: Record<string, unknown>[] = [{ term: { userId } }];
    if (input.taskId !== undefined) filter.push({ term: { taskId: input.taskId } });
    if (input.kind !== undefined) filter.push({ term: { kind: input.kind } });
    if (input.toolName !== undefined) filter.push({ term: { toolName: input.toolName } });
    const size = clampInt(limit, DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT);
    const from = clampInt(offset, 0, 0, MAX_SEARCH_OFFSET);
    const response = await search.search({
        index: "events",
        body: {
            size: size + 1,
            ...(from > 0 ? { from } : {}),
            track_total_hits: true,
            sort: [{ occurredAt: "desc" }],
            query: { bool: { must: [{ multi_match: { query: input.q, fields: ["title", "body"] } }], filter } },
        },
    });
    const hits = searchHits(response);
    const truncated = hits.length > size;
    const events = (truncated ? hits.slice(0, size) : hits).map((hit) => toSearchEvent(hit._id ?? "", hit._source ?? {}));
    for (const event of events) if (event.taskId !== "" && event.id !== "") ledger.recordEvents(event.taskId, [event]);
    return { events, truncated, total: searchTotal(response) ?? events.length };
}

export async function findSimilarTasks(
    search: RecipeSearchClient,
    userId: string,
    tasks: RecipeTaskReaderPort,
    anchorTaskId: string,
    limit: number,
): Promise<readonly SlimTask[] | null> {
    const anchor = await tasks.findById(userId, anchorTaskId);
    if (anchor === null) return null;
    const response = await search.search({
        index: "tasks",
        body: {
            size: clampInt(limit, DEFAULT_SIMILAR_TASK_LIMIT, 1, MAX_SIMILAR_TASK_LIMIT),
            query: {
                bool: {
                    must: [{ more_like_this: { fields: ["title"], like: anchor.title } }],
                    filter: [{ term: { userId } }],
                    must_not: [{ ids: { values: [anchorTaskId] } }],
                },
            },
        },
    });
    return searchHits(response).map((hit) => toSlimTask(hit._id ?? "", hit._source ?? {}));
}

export async function searchRecipes(
    search: RecipeSearchClient,
    userId: string,
    q: string,
    limit: number,
    ledger: ProvenanceLedger,
): Promise<readonly SlimRecipe[]> {
    const response = await search.search({
        index: "recipes",
        body: {
            size: clampInt(limit, DEFAULT_SIMILAR_TASK_LIMIT, 1, MAX_SIMILAR_TASK_LIMIT),
            query: {
                bool: {
                    must: [{ more_like_this: { fields: ["title", "intent", "summaryMd"], like: q } }],
                    filter: [{ term: { userId } }],
                },
            },
        },
    });
    const results = searchHits(response).map((hit) => toSlimRecipe(hit._id ?? "", hit._source ?? {}));
    for (const result of results) if (result.rev !== undefined) ledger.recordRecipe(result.id, result.rev);
    return results;
}

function responseBody(response: unknown): SearchResponseBody {
    const candidate = typeof response === "object" && response !== null && "body" in response ? response.body : response;
    return candidate ?? {};
}
function searchHits(response: unknown): readonly SearchHit[] {
    return responseBody(response).hits?.hits ?? [];
}
function searchTotal(response: unknown): number | undefined {
    const total = responseBody(response).hits?.total;
    if (typeof total === "number") return total;
    return typeof total === "object" && typeof total.value === "number" ? total.value : undefined;
}
function toSlimTask(id: string, source: Record<string, unknown>): SlimTask {
    const taskKind = readString(source["taskKind"]);
    const updatedAt = readString(source["updatedAt"]);
    return { id, title: readString(source["title"]) ?? "", status: readString(source["status"]) ?? "",
        ...(taskKind !== undefined ? { taskKind } : {}), ...(updatedAt !== undefined ? { updatedAt } : {}) };
}
function toSlimRecipe(id: string, source: Record<string, unknown>): SlimRecipe {
    const rev = readNumber(source["rev"]);
    const updatedAt = readString(source["updatedAt"]);
    return { id, title: readString(source["title"]) ?? "", intent: readString(source["intent"]) ?? "",
        status: readString(source["status"]) ?? "", userEdited: source["userEdited"] === true,
        ...(rev !== undefined ? { rev } : {}), ...(updatedAt !== undefined ? { updatedAt } : {}) };
}
function toSearchEvent(id: string, source: Record<string, unknown>): RecipeSearchEvent {
    const seq = source["seq"];
    const body = readString(source["body"]);
    const toolName = readString(source["toolName"]);
    return { id, taskId: readString(source["taskId"]) ?? "",
        seq: readString(seq) ?? (typeof seq === "number" ? String(seq) : ""), kind: readString(source["kind"]) ?? "",
        title: readString(source["title"]) ?? "", ...(body !== undefined ? { body } : {}),
        ...(toolName !== undefined ? { toolName } : {}), filePaths: readStringArray(source["filePaths"]),
        occurredAt: readString(source["occurredAt"]) ?? "" };
}
function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function readStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
