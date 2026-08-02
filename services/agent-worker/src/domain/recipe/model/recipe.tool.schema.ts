import {
    contractEnumValues,
    contractIntDefault,
    contractIntMax,
    contractLimit,
    contractToolDefinitions,
    contractToolShape,
    type ContractToolFile,
    type LlmToolDefinition,
    type ToolFailureTexts,
} from "@tracer-agent/llm";
import { z } from "zod";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentTools } from "~agent-worker/support/contract.js";

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

/** 계약이 배분을 적는 전문가의 축이며 도구 선언과 같은 어휘를 쓴다. */
export type RecipeProbeName = "timeline" | "rules" | "repetition";

/** 레시피 조사 도구 선언이며 조율자가 단독으로 쥐는 도구를 오케스트레이션 절이 갖는다. */
export interface RecipeToolContract extends ContractToolFile {
    readonly orchestration: {
        readonly workerMaxTurns: number;
        readonly surveyTools: readonly RecipeScanToolName[];
        readonly coordinatorTools: readonly RecipeScanToolName[];
        readonly roles: Readonly<Record<RecipeProbeName, readonly RecipeScanToolName[]>>;
    };
}

/** 두 구현체가 함께 읽는 도구 계약이며 값은 계약 저장소가 소유한다. */
export const RECIPE_TOOL_CONTRACT: RecipeToolContract = readAgentTools<RecipeToolContract>(
    AGENT.recipeScan.id,
);

export const EVENT_ORDER = { asc: "asc", desc: "desc" } as const;

export type EventOrder = (typeof EVENT_ORDER)[keyof typeof EVENT_ORDER];

const tool = (name: RecipeScanToolName): string => name;

export const DEFAULT_EVENT_LIMIT = contractIntDefault(RECIPE_TOOL_CONTRACT, tool("get_task_events"), "limit");
export const MAX_EVENT_LIMIT = contractIntMax(RECIPE_TOOL_CONTRACT, tool("get_task_events"), "limit");
export const DEFAULT_SEARCH_LIMIT = contractIntDefault(RECIPE_TOOL_CONTRACT, tool("search_events"), "limit");
export const MAX_SEARCH_LIMIT = contractIntMax(RECIPE_TOOL_CONTRACT, tool("search_events"), "limit");
export const MAX_SEARCH_OFFSET = contractIntMax(RECIPE_TOOL_CONTRACT, tool("search_events"), "offset");
export const DEFAULT_SIMILAR_TASK_LIMIT = contractIntDefault(
    RECIPE_TOOL_CONTRACT,
    tool("find_similar_tasks"),
    "limit",
);
export const MAX_SIMILAR_TASK_LIMIT = contractIntMax(
    RECIPE_TOOL_CONTRACT,
    tool("find_similar_tasks"),
    "limit",
);
export const SUMMARY_EVENT_WINDOW = contractIntDefault(
    RECIPE_TOOL_CONTRACT,
    tool("get_task_summary"),
    "window",
);
export const MAX_SUMMARY_EVENT_WINDOW = contractIntMax(
    RECIPE_TOOL_CONTRACT,
    tool("get_task_summary"),
    "window",
);
export const MAX_CITED_IDS = RECIPE_TOOL_CONTRACT.tools[RECIPE_SCAN_TOOL.checkCitations]?.args["eventIds"]
    ?.maxItems ?? 0;

/** 한 태스크가 서로 다른 작업 턴을 담을 수 있어 스캔 한 번이 낼 수 있는 후보 수다. */
export const RECIPE_CANDIDATE_LIMIT = contractLimit(RECIPE_TOOL_CONTRACT, "recipeCandidateLimit");

/** 한 번의 추가 파견 요청이 부를 수 있는 전문가 수의 상한이다. */
export const MAX_REDISPATCH_PROBES = contractLimit(RECIPE_TOOL_CONTRACT, "maxRedispatchProbes");

/** 조율자가 종합 대신 전문가를 다시 부를 수 있는 라운드 수이며 무한 순환을 이 값으로 막는다. */
export const MAX_REDISPATCH_ROUNDS = contractLimit(RECIPE_TOOL_CONTRACT, "maxRedispatchRounds");

/** 전문가 하나에 배정할 수 있는 조사 몫의 상한이다. */
export const MAX_PROBE_WEIGHT = contractLimit(RECIPE_TOOL_CONTRACT, "maxProbeWeight");

/** 검색이 걸러 낼 수 있는 이벤트 종류이며 값은 계약이 소유한다. */
export const TIMELINE_EVENT_KINDS: readonly [string, ...string[]] = contractEnumValues(
    RECIPE_TOOL_CONTRACT,
    RECIPE_SCAN_TOOL.searchEvents,
    "kind",
);

const shape = (name: RecipeScanToolName) =>
    contractToolShape(RECIPE_TOOL_CONTRACT.tools[name]!);

const getTaskSummaryShape = shape(RECIPE_SCAN_TOOL.getTaskSummary);
const getTaskEventsShape = shape(RECIPE_SCAN_TOOL.getTaskEvents);
const listRulesShape = shape(RECIPE_SCAN_TOOL.listRules);
const searchEventsShape = shape(RECIPE_SCAN_TOOL.searchEvents);
const findSimilarTasksShape = shape(RECIPE_SCAN_TOOL.findSimilarTasks);
const searchRecipesShape = shape(RECIPE_SCAN_TOOL.searchRecipes);
const checkCitationsShape = shape(RECIPE_SCAN_TOOL.checkCitations);

/** 이 에이전트가 모델에게 여는 도구 계약이며 목록은 계약의 tools가 소유한다. */
export const RECIPE_SCAN_TOOLS: readonly LlmToolDefinition[] =
    contractToolDefinitions(RECIPE_TOOL_CONTRACT);

export const RECIPE_SCAN_TOOL_NAMES: readonly string[] = RECIPE_SCAN_TOOLS.map((spec) => spec.name);

export interface GetTaskSummaryArgs {
    readonly taskId: string;
    readonly window?: number;
}

export interface GetTaskEventsArgs {
    readonly taskId: string;
    readonly limit?: number;
    readonly cursor?: string;
    readonly order?: EventOrder;
}

export interface ListRulesArgs {
    readonly taskId: string;
}

export interface SearchEventsArgs {
    readonly q: string;
    readonly taskId?: string;
    readonly kind?: string;
    readonly toolName?: string;
    readonly limit?: number;
    readonly offset?: number;
}

export interface FindSimilarTasksArgs {
    readonly anchorTaskId: string;
    readonly limit?: number;
}

export interface SearchRecipesArgs {
    readonly q: string;
    readonly limit?: number;
}

export interface CheckCitationsArgs {
    readonly taskId: string;
    readonly eventIds?: readonly string[];
    readonly turnIds?: readonly string[];
    readonly ruleIds?: readonly string[];
}

export function parseGetTaskSummaryArgs(raw: unknown): GetTaskSummaryArgs {
    return z.object(getTaskSummaryShape).parse(raw) as GetTaskSummaryArgs;
}

export function parseGetTaskEventsArgs(raw: unknown): GetTaskEventsArgs {
    return z.object(getTaskEventsShape).parse(raw) as GetTaskEventsArgs;
}

export function parseListRulesArgs(raw: unknown): ListRulesArgs {
    return z.object(listRulesShape).parse(raw) as ListRulesArgs;
}

export function parseSearchEventsArgs(raw: unknown): SearchEventsArgs {
    return z.object(searchEventsShape).parse(raw) as SearchEventsArgs;
}

export function parseFindSimilarTasksArgs(raw: unknown): FindSimilarTasksArgs {
    return z.object(findSimilarTasksShape).parse(raw) as FindSimilarTasksArgs;
}

export function parseSearchRecipesArgs(raw: unknown): SearchRecipesArgs {
    return z.object(searchRecipesShape).parse(raw) as SearchRecipesArgs;
}

export function parseCheckCitationsArgs(raw: unknown): CheckCitationsArgs {
    return z.object(checkCitationsShape).parse(raw) as CheckCitationsArgs;
}

/** 도구가 무너졌을 때와 전문가 하나가 통째로 무너졌을 때 읽는 문구이며 값은 계약이 소유한다. */
export const RECIPE_SCAN_FAILURES: ToolFailureTexts & { readonly workerFailed: string } =
    RECIPE_TOOL_CONTRACT.failures as ToolFailureTexts & { readonly workerFailed: string };
