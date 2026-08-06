import type { StructuredQueryResult } from "@tracer-agent/llm";
import { agentFailureAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import {
  AGENT_NODE,
  fanOutNode,
  pushRouteSelected,
  withNodeTrajectory,
  type RunSegment,
} from "~agent-worker/support/llm/run.segment.js";
import type {
  AgentBudgetLease,
  ExecutionBudget,
} from "~agent-worker/support/llm/agent.budget.js";
import { buildRecipeUserPrompt } from "~agent-worker/domain/recipe/model/recipe.prompt.js";
import {
  dispatchPlanSchema,
  type DispatchPlan,
  type ProbeReport,
    probeDepthShare,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import { ProvenanceLedger } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import {
  RECIPE_STAGE,
  type RecipeStageResumePort,
} from "~agent-worker/domain/recipe/port/recipe.stage.output.port.js";
import type { RecipeToolDeps } from "./recipe.tools.js";
import {
  RECIPE_SCAN_SPEC,
  recipeModelName,
  type RecipeQueryContext,
} from "./recipe.sdk.query.js";
import { runRecipeSurvey } from "./recipe.sdk.survey.js";
import { runRecipeProbe, type RecipeProbeRun } from "./recipe.sdk.probe.js";
import {
  probeStageSchema,
  type ProbeStageOutput,
} from "~agent-worker/domain/recipe/model/recipe.stage.schema.js";
import {
  runRecipeSynthesis,
  type RecipeSynthesisRun,
} from "./recipe.sdk.investigate.js";
import { recordProbeExhaustion } from "~agent-worker/support/llm/execution.metrics.js";
const AGENT_NAME = RECIPE_SCAN_SPEC.name;

// 한 실행에 한 번뿐인 단계는 자리를 가를 것이 없다.
const STAGE_SINGLETON_SLOT = "-";

/** 전문가는 축마다 그리고 재파견 라운드마다 다른 자리에 선다. */
function probeSlot(round: number, probe: string): string {
    return `${round}:${probe}`;
}

/** 원장에서 되살린 전문가 하나의 결과이며 모델을 다시 부르지 않는다. */
function restoredProbeRun(stored: ProbeStageOutput): RecipeProbeRun {
    return {
        report: stored.report,
        ledger: ProvenanceLedger.from(stored.ledger),
        accounting: stored.accounting,
        steps: [],
    };
}

/** 계획 단계가 낸 결과이며 degraded는 계획 호출이 실패해 빈 계획으로 낮췄음을 뜻한다. */
export interface RecipeSurveyPhase {
    readonly plan: DispatchPlan;
    readonly modelUsed: string;
    readonly degraded: boolean;
}

export async function runRecipeSurveyPhase(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  budget: ExecutionBudget,
  lease: AgentBudgetLease,
  segments: RunSegment[],
  availableTurns: number,
  stages: RecipeStageResumePort | null = null,
): Promise<RecipeSurveyPhase> {
  const fallback = {
    plan: { probes: [] } as DispatchPlan,
    modelUsed: recipeModelName(ctx.input),
    degraded: false,
  };
  if (lease.maxTurns <= 0) return fallback;
  const restored = await stages?.restore(
    RECIPE_STAGE.survey,
    STAGE_SINGLETON_SLOT,
    dispatchPlanSchema,
  );
  // 앞선 시도가 이미 세운 계획이 있으면 조율자를 다시 부르지 않는다.
  if (restored != null)
    return { plan: restored, modelUsed: recipeModelName(ctx.input), degraded: false };
  try {
    const run = await withNodeTrajectory(segments, AGENT_NAME, AGENT_NODE.survey, () =>
      runRecipeSurvey(ctx, deps, availableTurns, lease),
    );
    budget.settle(lease, { costUsd: run.costUsd, numTurns: run.numTurns });
    await stages?.record(RECIPE_STAGE.survey, STAGE_SINGLETON_SLOT, run.data);
    segments.push(toRunSegment(run, AGENT_NODE.survey));
    const chosen =
      run.data.probes.map(({ probe, depth }) => `${probe}:${depth}`).join(", ") || "no specialists";
    pushRouteSelected(segments, AGENT_NODE.survey, `survey -> ${chosen}`);
    return { plan: run.data, modelUsed: run.modelUsed, degraded: false };
  } catch (error) {
    const accounting = agentFailureAccounting(error, recipeModelName(ctx.input));
    budget.settle(lease, {
      costUsd: accounting.costUsd,
      numTurns: accounting.numTurns,
    });
    segments.push({ accounting, steps: [], nodeName: AGENT_NODE.survey });
    // 계획 호출이 실패해 빈 계획으로 낮춘 실행은 저장할 패턴이 없던 실행과 사유가 다르다.
    return { ...fallback, degraded: true };
  }
}

export async function dispatchRecipeProbes(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  budget: ExecutionBudget,
  plan: DispatchPlan,
  coordinatorLedger: ProvenanceLedger,
  segments: RunSegment[],
  stages: RecipeStageResumePort | null = null,
  round = 0,
): Promise<ProbeReport[]> {
  const leases = budget.leaseMany(
    plan.probes.map(({ depth }) => probeDepthShare(depth)),
    1,
  );
  const runs = await Promise.all(
    plan.probes.map((assignment, index) =>
      withNodeTrajectory(segments, AGENT_NAME, "probe", async () => {
        const slot = probeSlot(round, assignment.probe);
        const restored = await stages?.restore(RECIPE_STAGE.probe, slot, probeStageSchema);
        // 앞선 시도가 이미 끝낸 전문가는 그 보고와 장부를 그대로 쓴다.
        if (restored != null) return restoredProbeRun(restored);
        const run = await runRecipeProbe(
          ctx,
          deps,
          assignment,
          leases[index]!,
          plan.probes.filter((other) => other.probe !== assignment.probe),
        );
        await stages?.record(RECIPE_STAGE.probe, slot, {
          report: run.report,
          ledger: run.ledger.snapshot(),
          accounting: run.accounting,
        });
        return run;
      }),
    ),
  );
  return runs.map((run, index) => {
    const lease = leases[index]!;
    recordProbeExhaustion(AGENT_NAME, run.report.probe, run.accounting.costUsd, lease.maxBudgetUsd);
    budget.settle(lease, {
      costUsd: run.accounting.costUsd,
      numTurns: run.accounting.numTurns,
    });
    coordinatorLedger.mergeFrom(run.ledger);
    segments.push({
      accounting: run.accounting,
      steps: run.steps,
      nodeName: fanOutNode(AGENT_NODE.probe, run.report.probe),
    });
    return run.report;
  });
}

export async function synthesizeRecipe(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  budget: ExecutionBudget,
  floorLease: AgentBudgetLease,
  plan: DispatchPlan,
  reports: readonly ProbeReport[],
  coordinatorLedger: ProvenanceLedger,
  segments: RunSegment[],
): Promise<RecipeSynthesisRun> {
  const lease = budget.combine([floorLease, budget.lease(1)]);
  const prompt = buildRecipeUserPrompt(
    ctx.prompt,
    ctx.input.taskId,
    ctx.input.userPrompt,
    ctx.input.language,
    plan,
    reports,
    coordinatorLedger.snapshot(),
  );
  const run = await withNodeTrajectory(segments, AGENT_NAME, AGENT_NODE.investigate, () =>
    runRecipeSynthesis(ctx, deps, coordinatorLedger, prompt, lease, AGENT_NODE.investigate),
  );
  budget.settle(lease, { costUsd: run.costUsd, numTurns: run.numTurns });
  segments.push(toRunSegment(run, AGENT_NODE.investigate));
  return run;
}

export function toRunSegment(
  run: StructuredQueryResult<unknown>,
  nodeName: string,
): RunSegment {
  return {
    accounting: {
      durationMs: run.durationMs,
      costUsd: run.costUsd,
      numTurns: run.numTurns,
      usage: run.usage,
    },
    steps: run.steps,
    nodeName,
  };
}
