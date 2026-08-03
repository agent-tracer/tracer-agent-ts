import {
    featureLimits,
    loadExecutionBudgetContract,
    renderFailureText,
} from "@tracer-agent/llm";
import { deadlineFractionMs } from "~agent-worker/support/llm/agent.deadline.js";
import { RECIPE_FEATURE } from "./recipe.const.js";
import {
    MAX_PROBE_WEIGHT,
    MAX_VERDICT_CHARS,
    type ProbeReport,
    type RecipeProbeName,
} from "./recipe.dispatch.schema.js";
import {
    RECIPE_SCAN_FAILURES,
    RECIPE_TOOL_CONTRACT,
    type RecipeScanToolName,
} from "./recipe.tool.schema.js";

const { reservation, wallClock } = loadExecutionBudgetContract();
const RECIPE_LIMITS = featureLimits(RECIPE_FEATURE);

// 첫 실행이 예산을 거의 다 써도 수리가 도구를 쥔 채 출력을 낼 최소 여지는 남긴다.
export const REPAIR_RESERVED_TURNS = reservation.repair.turns;
export const REPAIR_RESERVED_BUDGET_SHARE = reservation.repair.budgetShare;

// 계획을 세우는 데 한 턴을 예약해 두므로 나머지가 전문가와 종합의 몫이다.
export const SURVEY_TURNS = reservation.survey.turns;
export const SURVEY_BUDGET_SHARE = reservation.survey.budgetShare;

/** 종합에 먼저 떼어 두는, 전문가에게 넘기지 않는 최소 턴이다. */
export const MIN_SYNTHESIS_TURNS = reservation.synthesisFloor.turns;

/** 조율자가 진전 없이 머무는 상한이다. */
export const SURVEY_WALL_CLOCK_MS = deadlineFractionMs(RECIPE_LIMITS.deadlineMs, wallClock.survey);

/** 전문가가 진전 없이 머무는 상한이며 몫이 큰 전문가가 자연히 더 오래 진행 중인 것을 막지 않는다. */
export const PROBE_WALL_CLOCK_CEILING_MS = deadlineFractionMs(RECIPE_LIMITS.deadlineMs, wallClock.probe);

/** 종합과 수리가 진전 없이 머무는 상한이다. */
export const SYNTHESIS_WALL_CLOCK_MS = deadlineFractionMs(RECIPE_LIMITS.deadlineMs, wallClock.synthesis);

/** 달러 몫이 아주 작은 전문가도 이만큼은 받아 조사를 시작할 수 있다. */
export const PROBE_MIN_WALL_CLOCK_FRACTION = wallClock.probeMinFraction.value;

/** weight 상한이 곧 전문가 하나가 받을 수 있는 턴 백스톱이며 조사 깊이는 달러 몫이 정한다. */
export const RECIPE_WORKER_MAX_TURNS = MAX_PROBE_WEIGHT;

/** 계획이 규모를 모른 채 서지 않도록 조율자가 요약 하나를 가진다. */
export const RECIPE_SURVEY_TOOLS: readonly RecipeScanToolName[] = RECIPE_TOOL_CONTRACT.orchestration.surveyTools;

/** 조율자는 근거를 직접 모으지 않고 전문가가 합친 장부의 인용만 확인한다. */
export const RECIPE_COORDINATOR_TOOLS: readonly RecipeScanToolName[] =
    RECIPE_TOOL_CONTRACT.orchestration.coordinatorTools;

/** 전문가는 자기 근거 원천에 닿는 도구만 가지고 어느 전문가든 쓰는 인용 확인만 모두에게 준다. */
export const RECIPE_PROBE_TOOL_NAMES: Readonly<Record<RecipeProbeName, readonly RecipeScanToolName[]>> =
    RECIPE_TOOL_CONTRACT.orchestration.roles;


export function probeToolNames(probe: RecipeProbeName): readonly RecipeScanToolName[] {
    return RECIPE_PROBE_TOOL_NAMES[probe];
}


/** 전문가 실행이 실패한 사유를 판정 상한 안으로 줄여 실패 보고로 낮춘다. */
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
