import { AGENT } from "~agent-worker/support/agent.const.js";
import type {
    RecipeEvent,
    RecipeEventReaderPort,
    RecipeRuleReaderPort,
    RecipeTaskReaderPort,
} from "~agent-worker/domain/recipe/port/recipe.reader.port.js";
import { type ToolHandlers, withToolTelemetry } from "@tracer-agent/llm";
import { clampInt } from "~agent-worker/support/clamp.js";
import { toRecipeEventPage, type RecipeSlimEvent } from "~agent-worker/domain/recipe/model/recipe.event.model.js";
import {
    isEventVerified,
    isRuleVerified,
    isTurnVerified,
    ProvenanceLedger,
} from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { buildTaskSummary, type TaskSummaryEvent } from "~agent-worker/domain/recipe/model/task.summary.model.js";
import {
    DEFAULT_EVENT_LIMIT,
    DEFAULT_SEARCH_LIMIT,
    DEFAULT_SIMILAR_TASK_LIMIT,
    EVENT_ORDER,
    MAX_EVENT_LIMIT,
    MAX_SEARCH_LIMIT,
    MAX_SEARCH_OFFSET,
    MAX_SIMILAR_TASK_LIMIT,
    MAX_SUMMARY_EVENT_WINDOW,
    parseFindSimilarTasksArgs,
    parseGetTaskEventsArgs,
    parseGetTaskSummaryArgs,
    parseListRulesArgs,
    parseSearchEventsArgs,
    parseCheckCitationsArgs,
    parseSearchRecipesArgs,
    RECIPE_SCAN_TOOL,
    SUMMARY_EVENT_WINDOW,
} from "~agent-worker/domain/recipe/model/recipe.tool.schema.js";
import { toSlimRule } from "./recipe.rule.view.js";
import type { RecipeSearchPort } from "~agent-worker/domain/recipe/port/recipe.search.port.js";

const AGENT_NAME = AGENT.recipeScan.id;

/** recipe 도구가 쓰는 저장소 읽기 표면과 검색 클라이언트를 묶으며, 이 부분집합이 실제 저장소와 평가용 스냅샷 구현을 갈아끼우는 자리다. */
export interface RecipeToolDeps {
    readonly tasks: RecipeTaskReaderPort;
    readonly events: RecipeEventReaderPort;
    readonly rules: RecipeRuleReaderPort;
    readonly search: RecipeSearchPort;
}

/** 사용자 범위와 실행 단위 근거 장부를 고정한 recipe 도구 핸들러를 만든다. */
export function buildRecipeToolHandlers(
    userId: string,
    deps: RecipeToolDeps,
    ledger: ProvenanceLedger = new ProvenanceLedger(),
): ToolHandlers {
    const telemetry = async (
        toolName: string,
        parameters: Record<string, unknown>,
        run: () => Promise<string>,
    ): Promise<string> => withToolTelemetry({ toolName, agentName: AGENT_NAME, parameters }, run);

    return {
        [RECIPE_SCAN_TOOL.getTaskSummary]: async (raw) => {
            const { taskId, window } = parseGetTaskSummaryArgs(raw);
            return telemetry(RECIPE_SCAN_TOOL.getTaskSummary, { taskId, window }, async () => {
                const task = await deps.tasks.findById(userId, taskId);
                if (task === null) return notFound(taskId);
                const size = clampInt(window, SUMMARY_EVENT_WINDOW, 1, MAX_SUMMARY_EVENT_WINDOW);
                const [events, totalEventCount] = await Promise.all([
                    deps.events.findTimeline(userId, taskId, undefined, size),
                    deps.events.countByTask(userId, taskId),
                ]);
                return dump(
                    buildTaskSummary(
                        {
                            id: task.id,
                            title: task.title,
                            status: task.status,
                            taskKind: task.taskKind,
                            ...(task.workspacePath !== null ? { workspacePath: task.workspacePath } : {}),
                            createdAt: task.createdAt.toISOString(),
                            updatedAt: task.updatedAt.toISOString(),
                        },
                        events.map(toSummaryEvent),
                        totalEventCount,
                    ),
                );
            });
        },

        // recipe 슬라이스가 자기 이벤트 조회 도구를 소유한다.
        [RECIPE_SCAN_TOOL.getTaskEvents]: async (raw) => {
            const { taskId, limit, cursor, order } = parseGetTaskEventsArgs(raw);
            return telemetry(RECIPE_SCAN_TOOL.getTaskEvents, { taskId, limit, cursor, order }, async () => {
                const task = await deps.tasks.findById(userId, taskId);
                if (task === null) return notFound(taskId);
                const size = clampInt(limit, DEFAULT_EVENT_LIMIT, 1, MAX_EVENT_LIMIT);
                const reading = order ?? EVENT_ORDER.asc;
                const [rows, total] = await Promise.all([
                    reading === EVENT_ORDER.desc
                        ? deps.events.findTimelineWindow(userId, taskId, cursor, size + 1)
                        : deps.events.findTimeline(userId, taskId, cursor !== undefined ? { seq: cursor } : undefined, size + 1),
                    deps.events.countByTask(userId, taskId),
                ]);
                const page = toRecipeEventPage(rows.map(toSlimEvent), size, total);
                ledger.recordEvents(taskId, page.events);
                return dump(page);
            });
        },

        [RECIPE_SCAN_TOOL.listRules]: async (raw) => {
            const { taskId } = parseListRulesArgs(raw);
            return telemetry(RECIPE_SCAN_TOOL.listRules, { taskId }, async () => {
                const rules = (await deps.rules.findApplicable(userId, taskId)).map(toSlimRule);
                ledger.recordRules(rules.map((rule) => rule.id));
                return dump(rules);
            });
        },

        [RECIPE_SCAN_TOOL.searchEvents]: async (raw) => {
            const { q, taskId, kind, toolName, limit, offset } = parseSearchEventsArgs(raw);
            return telemetry(
                RECIPE_SCAN_TOOL.searchEvents,
                { q, taskId, kind, toolName, limit, offset },
                async () => {
                    const page = await deps.search.searchEvents(userId, {
                        q,
                        ...(taskId !== undefined ? { taskId } : {}),
                        ...(kind !== undefined ? { kind } : {}),
                        ...(toolName !== undefined ? { toolName } : {}),
                        limit: clampInt(limit, DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT),
                        offset: clampInt(offset, 0, 0, MAX_SEARCH_OFFSET),
                    });
                    for (const event of page.events) {
                        if (event.taskId !== "" && event.id !== "") ledger.recordEvents(event.taskId, [event]);
                    }
                    return dump(page);
                },
            );
        },

        [RECIPE_SCAN_TOOL.findSimilarTasks]: async (raw) => {
            const { anchorTaskId, limit } = parseFindSimilarTasksArgs(raw);
            return telemetry(RECIPE_SCAN_TOOL.findSimilarTasks, { anchorTaskId, limit }, async () => {
                const anchor = await deps.tasks.findById(userId, anchorTaskId);
                if (anchor === null) return notFound(anchorTaskId);
                const size = clampInt(limit, DEFAULT_SIMILAR_TASK_LIMIT, 1, MAX_SIMILAR_TASK_LIMIT);
                const found = await deps.search.searchTasks(userId, anchor.title, size + 1);
                return dump(found.filter((task) => task.id !== anchorTaskId).slice(0, size));
            });
        },

        [RECIPE_SCAN_TOOL.checkCitations]: async (raw) => {
            const { taskId, eventIds, turnIds, ruleIds } = parseCheckCitationsArgs(raw);
            return telemetry(RECIPE_SCAN_TOOL.checkCitations, { taskId }, () => {
                const seen = ledger.snapshot();
                return Promise.resolve(
                    dump({
                        taskSupported: seen.eventIdsByTask[taskId] !== undefined,
                        unsupportedEventIds: (eventIds ?? []).filter((id) => !isEventVerified(seen, taskId, id)).sort(),
                        unsupportedTurnIds: (turnIds ?? []).filter((id) => !isTurnVerified(seen, taskId, id)).sort(),
                        unsupportedRuleIds: (ruleIds ?? []).filter((id) => !isRuleVerified(seen, id)).sort(),
                    }),
                );
            });
        },

        [RECIPE_SCAN_TOOL.searchRecipes]: async (raw) => {
            const { q, limit } = parseSearchRecipesArgs(raw);
            return telemetry(RECIPE_SCAN_TOOL.searchRecipes, { q, limit }, async () => {
                const found = await deps.search.searchRecipes(
                    userId,
                    q,
                    clampInt(limit, DEFAULT_SIMILAR_TASK_LIMIT, 1, MAX_SIMILAR_TASK_LIMIT),
                );
                for (const recipe of found) {
                    if (recipe.rev !== undefined) ledger.recordRecipe(recipe.id, recipe.rev);
                }
                return dump(found);
            });
        },
    };
}

function toSlimEvent(event: RecipeEvent): RecipeSlimEvent {
    return {
        id: event.id,
        seq: event.seq,
        ...(event.turnId !== null ? { turnId: event.turnId } : {}),
        kind: event.kind,
        title: event.title,
        ...(event.body !== null ? { body: event.body } : {}),
        ...(event.toolName !== null ? { toolName: event.toolName } : {}),
        filePaths: event.filePaths,
        occurredAt: event.occurredAt.toISOString(),
    };
}

function toSummaryEvent(event: RecipeEvent): TaskSummaryEvent {
    return { ...toSlimEvent(event), metadata: event.metadata };
}

function notFound(taskId: string): string {
    return `Task ${taskId} not found.`;
}

function dump(value: unknown): string {
    return JSON.stringify(value);
}
