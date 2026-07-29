import { renderFailureText, type LlmToolDefinition } from "@tracer-agent/llm";
import {
    MAX_PROBE_WEIGHT,
    MAX_VERDICT_CHARS,
    type ProbeReport,
    type RecipeProbeName,
} from "./recipe.dispatch.schema.js";
import { RECIPE_SCAN_FAILURES, RECIPE_SCAN_TOOL, RECIPE_SCAN_TOOLS } from "./recipe.tool.schema.js";

// 첫 실행이 예산을 거의 다 써도 수리가 도구를 쥔 채 출력을 낼 최소 여지는 남긴다.
export const REPAIR_RESERVED_TURNS = 2;
export const REPAIR_RESERVED_BUDGET_SHARE = 0.2;

// 계획을 세우는 데 한 턴을 예약해 두므로 나머지가 전문가와 종합의 몫이다.
export const SURVEY_TURNS = 1;
export const SURVEY_BUDGET_SHARE = 0.1;

/** 종합에 먼저 떼어 두는, 전문가에게 넘기지 않는 최소 턴이다. */
export const MIN_SYNTHESIS_TURNS = 3;

/** weight 상한이 곧 전문가 하나가 받을 수 있는 턴 백스톱이며 조사 깊이는 달러 몫이 정한다. */
export const RECIPE_WORKER_MAX_TURNS = MAX_PROBE_WEIGHT;

/** 조율자는 근거를 직접 모으지 않고 전문가가 합친 장부의 인용만 확인하므로 도구가 하나다. */
export const RECIPE_COORDINATOR_TOOLS = [RECIPE_SCAN_TOOL.checkCitations] as const;

/** 전문가는 자기 근거 원천에 닿는 도구만 쥐고 어느 전문가든 쓰는 인용 확인만 모두에게 준다. */
export const RECIPE_PROBE_TOOL_NAMES: Readonly<Record<RecipeProbeName, readonly string[]>> = {
    timeline: [
        RECIPE_SCAN_TOOL.getTaskSummary,
        RECIPE_SCAN_TOOL.getTaskEvents,
        RECIPE_SCAN_TOOL.searchEvents,
        RECIPE_SCAN_TOOL.checkCitations,
    ],
    rules: [
        RECIPE_SCAN_TOOL.listRules,
        RECIPE_SCAN_TOOL.searchRecipes,
        RECIPE_SCAN_TOOL.checkCitations,
    ],
    repetition: [
        RECIPE_SCAN_TOOL.searchEvents,
        RECIPE_SCAN_TOOL.findSimilarTasks,
        RECIPE_SCAN_TOOL.checkCitations,
    ],
};

export function probeToolNames(probe: RecipeProbeName): readonly string[] {
    return RECIPE_PROBE_TOOL_NAMES[probe];
}

export function probeToolSpecs(probe: RecipeProbeName): readonly LlmToolDefinition[] {
    const names = new Set<string>(RECIPE_PROBE_TOOL_NAMES[probe]);
    return RECIPE_SCAN_TOOLS.filter((spec) => names.has(spec.name));
}

/** 전문가 실행이 무너진 사유를 판정 상한 안으로 줄여 실패 보고로 강등한다. */
export function buildProbeFailureReport(probe: RecipeProbeName, error: unknown): ProbeReport {
    const summary = messageOf(error).trim() || "unknown error";
    return {
        probe,
        verdict: renderFailureText(RECIPE_SCAN_FAILURES.workerFailed, { reason: summary }).slice(
            0,
            MAX_VERDICT_CHARS,
        ),
        excerpts: [],
        exhausted: true,
    };
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
