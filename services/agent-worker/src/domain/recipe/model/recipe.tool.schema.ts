import type { LlmToolDefinition, ToolFailureTexts } from "@tracer-agent/llm";
import { z, type ZodRawShape } from "zod";
import { readContractJson } from "~agent-worker/support/contract.js";

export const RECIPE_SCAN_TOOL = {
    getTaskSummary: "get_task_summary",
    getTaskEvents: "get_task_events",
    listRules: "list_rules",
    searchEvents: "search_events",
    findSimilarTasks: "find_similar_tasks",
    searchRecipes: "search_recipes",
    checkCitations: "check_citations",
} as const;

export type RecipeScanToolName = (typeof RECIPE_SCAN_TOOL)[keyof typeof RECIPE_SCAN_TOOL];

export const EVENT_ORDER = { asc: "asc", desc: "desc" } as const;

export type EventOrder = (typeof EVENT_ORDER)[keyof typeof EVENT_ORDER];

export const DEFAULT_EVENT_LIMIT = 100;
export const MAX_EVENT_LIMIT = 300;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;
export const MAX_CITED_IDS = 200;
// 검색 엔진 기본 결과창을 offset과 limit의 합이 넘지 않도록 잡은 상한이다.
export const MAX_SEARCH_OFFSET = 9_900;
export const DEFAULT_SIMILAR_TASK_LIMIT = 5;
export const MAX_SIMILAR_TASK_LIMIT = 20;
export const SUMMARY_EVENT_WINDOW = 400;
export const MAX_SUMMARY_EVENT_WINDOW = 2_000;

interface RecipeToolContract {
    readonly tools: Readonly<Record<string, { readonly enums?: Readonly<Record<string, { readonly values: readonly string[] }>> }>>;
}

interface RecipeSpecFile {
    readonly tools: RecipeToolContract;
}

/** 검색이 걸러 낼 수 있는 이벤트 종류이며 값은 계약이 소유한다. */
export const TIMELINE_EVENT_KINDS: readonly [string, ...string[]] = (() => {
    const values = readContractJson<RecipeSpecFile>("agent/recipe-scan/spec.json").tools.tools[
        RECIPE_SCAN_TOOL.searchEvents
    ]?.enums?.["kind"]?.values;
    if (values === undefined || values.length === 0) throw new Error("recipe-scan contract has no event kinds");
    return [...values] as [string, ...string[]];
})();

const getTaskSummaryShape = {
    taskId: z.string().trim().min(1).describe("The task ID"),
    window: z
        .number()
        .int()
        .min(1)
        .max(MAX_SUMMARY_EVENT_WINDOW)
        .optional()
        .describe(
            `How many of the task's earliest events to aggregate (default ${SUMMARY_EVENT_WINDOW}, hard cap ${MAX_SUMMARY_EVENT_WINDOW})`,
        ),
} as const;

const getTaskEventsShape = {
    taskId: z.string().trim().min(1).describe("The task ID"),
    limit: z
        .number()
        .int()
        .min(1)
        .max(MAX_EVENT_LIMIT)
        .optional()
        .describe(`Max events to return in this page (default ${DEFAULT_EVENT_LIMIT}, hard cap ${MAX_EVENT_LIMIT})`),
    cursor: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Opaque cursor from a previous call's nextCursor. Omit to start from the first page."),
    order: z
        .enum([EVENT_ORDER.asc, EVENT_ORDER.desc])
        .optional()
        .describe(
            'Reading direction: "asc" (default) pages from the earliest event forward; "desc" pages from the latest event backward.',
        ),
} as const;

const listRulesShape = {
    taskId: z.string().trim().min(1).describe("The anchor task ID"),
} as const;

const searchEventsShape = {
    q: z.string().trim().min(1).describe("Search query"),
    taskId: z.string().trim().min(1).optional().describe("Optional task ID filter"),
    kind: z
        .enum(TIMELINE_EVENT_KINDS)
        .optional()
        .describe("Optional event kind filter. Must be one of the known event kinds."),
    toolName: z.string().trim().min(1).optional().describe("Optional tool name filter"),
    limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional().describe("Max results per call"),
    offset: z
        .number()
        .int()
        .min(0)
        .max(MAX_SEARCH_OFFSET)
        .optional()
        .describe("How many ranked results to skip; combine with limit to page beyond the first batch"),
} as const;

const findSimilarTasksShape = {
    anchorTaskId: z.string().trim().min(1).describe("The anchor task ID"),
    limit: z.number().int().min(1).max(MAX_SIMILAR_TASK_LIMIT).optional().describe("Max tasks"),
} as const;

const checkCitationsShape = {
    taskId: z.string().trim().min(1).describe("The task the cited IDs belong to"),
    eventIds: z
        .array(z.string().trim().min(1))
        .max(MAX_CITED_IDS)
        .optional()
        .describe("Event IDs you intend to cite"),
    turnIds: z
        .array(z.string().trim().min(1))
        .max(MAX_CITED_IDS)
        .optional()
        .describe("Turn IDs you intend to cite"),
    ruleIds: z
        .array(z.string().trim().min(1))
        .max(MAX_CITED_IDS)
        .optional()
        .describe("Rule IDs you intend to cite in governing_rules"),
} as const;

const searchRecipesShape = {
    q: z.string().trim().min(1).describe("Search query"),
    limit: z.number().int().min(1).max(MAX_SIMILAR_TASK_LIMIT).optional().describe("Max recipes"),
} as const;

const GET_TASK_EVENTS_DESCRIPTION =
    `Get a page of a task's chronological event sequence (user messages, assistant messages, tool runs), `
    + `up to ${MAX_EVENT_LIMIT} events per page. You choose how much to read: pick limit, pass the response's `
    + `nextCursor back as cursor to keep paging, and set order="desc" to start from the latest events. `
    + `truncated/total tell you whether more events exist.`;

const CHECK_CITATIONS_DESCRIPTION =
    "Check whether the IDs you plan to cite are backed by what your tools actually returned, before you write the final candidates. Pass the task plus the event, turn, and rule IDs you intend to use; the response names the ones that are not citable. A single unsupported ID gets the whole candidate list rejected, so verify here instead of spending your one repair on it.";

const DESCRIPTIONS: Readonly<Record<RecipeScanToolName, string>> = {
    [RECIPE_SCAN_TOOL.getTaskSummary]:
        `Get a cheap task overview (tool usage counts, top files touched, top commands run, first user message) aggregated over the task's earliest events, window many, default ${SUMMARY_EVENT_WINDOW}. The response's truncated/totalEventCount fields tell you whether later events were left out.`,
    [RECIPE_SCAN_TOOL.getTaskEvents]: GET_TASK_EVENTS_DESCRIPTION,
    [RECIPE_SCAN_TOOL.listRules]:
        "List existing global and task-scoped rules that apply to the anchor task, so friction a rule already governs is cited by rule ID in governing_rules instead of re-described.",
    [RECIPE_SCAN_TOOL.searchEvents]:
        `Search indexed events by title/body, ranked by recency. Use q with optional taskId, kind, or toolName filters to find user corrections, instructions, and friction evidence. Pick limit (up to ${MAX_SEARCH_LIMIT} per call) and offset to page through as many results as you need.`,
    [RECIPE_SCAN_TOOL.findSimilarTasks]:
        "Find tasks with titles similar to the anchor task. Use after inspecting the anchor to check whether the workflow repeats.",
    [RECIPE_SCAN_TOOL.searchRecipes]:
        "Search existing recipes for possible duplicate or outdated targets. Use this before setting revises_recipe_id.",
    [RECIPE_SCAN_TOOL.checkCitations]: CHECK_CITATIONS_DESCRIPTION,
};

const SHAPES: Readonly<Record<RecipeScanToolName, ZodRawShape>> = {
    [RECIPE_SCAN_TOOL.getTaskSummary]: getTaskSummaryShape,
    [RECIPE_SCAN_TOOL.getTaskEvents]: getTaskEventsShape,
    [RECIPE_SCAN_TOOL.listRules]: listRulesShape,
    [RECIPE_SCAN_TOOL.searchEvents]: searchEventsShape,
    [RECIPE_SCAN_TOOL.findSimilarTasks]: findSimilarTasksShape,
    [RECIPE_SCAN_TOOL.searchRecipes]: searchRecipesShape,
    [RECIPE_SCAN_TOOL.checkCitations]: checkCitationsShape,
};

/** 이 에이전트가 모델에게 여는 도구 계약이며 목록은 계약의 tools가 소유한다. */
export const RECIPE_SCAN_TOOLS: readonly LlmToolDefinition[] = Object.values(RECIPE_SCAN_TOOL).map(
    (name) => ({ name, description: DESCRIPTIONS[name], shape: SHAPES[name] }),
);

export const RECIPE_SCAN_TOOL_NAMES: readonly string[] = RECIPE_SCAN_TOOLS.map((spec) => spec.name);

export type GetTaskSummaryArgs = z.infer<z.ZodObject<typeof getTaskSummaryShape>>;
export type GetTaskEventsArgs = z.infer<z.ZodObject<typeof getTaskEventsShape>>;
export type ListRulesArgs = z.infer<z.ZodObject<typeof listRulesShape>>;
export type SearchEventsArgs = z.infer<z.ZodObject<typeof searchEventsShape>>;
export type FindSimilarTasksArgs = z.infer<z.ZodObject<typeof findSimilarTasksShape>>;
export type CheckCitationsArgs = z.infer<z.ZodObject<typeof checkCitationsShape>>;
export type SearchRecipesArgs = z.infer<z.ZodObject<typeof searchRecipesShape>>;

export function parseGetTaskSummaryArgs(raw: unknown): GetTaskSummaryArgs {
    return z.object(getTaskSummaryShape).parse(raw);
}

export function parseGetTaskEventsArgs(raw: unknown): GetTaskEventsArgs {
    return z.object(getTaskEventsShape).parse(raw);
}

export function parseListRulesArgs(raw: unknown): ListRulesArgs {
    return z.object(listRulesShape).parse(raw);
}

export function parseSearchEventsArgs(raw: unknown): SearchEventsArgs {
    return z.object(searchEventsShape).parse(raw);
}

export function parseFindSimilarTasksArgs(raw: unknown): FindSimilarTasksArgs {
    return z.object(findSimilarTasksShape).parse(raw);
}

export function parseCheckCitationsArgs(raw: unknown): CheckCitationsArgs {
    return z.object(checkCitationsShape).parse(raw);
}

export function parseSearchRecipesArgs(raw: unknown): SearchRecipesArgs {
    return z.object(searchRecipesShape).parse(raw);
}

/** 도구가 무너졌을 때와 전문가 하나가 통째로 무너졌을 때 읽는 문구이며 값은 계약이 소유한다. */
export const RECIPE_SCAN_FAILURES: ToolFailureTexts & { readonly workerFailed: string } = {
    toolFailed:
        "Tool {tool} failed: {reason}. Do not call it again more than once. "
        + "Continue with the evidence you already have, and state in your rationale "
        + "which evidence you could not check.",
    workerFailed: "Investigation failed: {reason}",
};
