import type { StructuredQueryResult } from "@tracer-agent/llm";
import type {
  AgentBudgetLease,
  ExecutionBudget,
} from "~agent-worker/support/llm/agent.budget.js";
import { buildRecipeUserPrompt } from "~agent-worker/domain/recipe/model/recipe.prompt.js";
import type {
  DispatchPlan,
  ProbeReport,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import type { ProvenanceLedger } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import type { RecipeToolDeps } from "./recipe.tools.js";
import {
  RECIPE_SCAN_SPEC,
  recipeModelName,
  type RecipeQueryContext,
} from "./recipe.sdk.query.js";
import { runRecipeSurvey } from "./recipe.sdk.survey.js";
import { agentFailureAccounting, runRecipeProbe } from "./recipe.sdk.probe.js";
import {
  runRecipeSynthesis,
  type RecipeSynthesisRun,
} from "./recipe.sdk.investigate.js";
import { recordProbeExhaustion } from "~agent-worker/support/llm/execution.metrics.js";
import {
  pushRouteSelected,
  withNodeTrajectory,
  type RecipeRunSegment,
} from "./recipe.node.trace.js";

export type { RecipeRunSegment };

const AGENT_NAME = RECIPE_SCAN_SPEC.name;

export async function runRecipeSurveyPhase(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  budget: ExecutionBudget,
  lease: AgentBudgetLease,
  segments: RecipeRunSegment[],
  availableTurns: number,
): Promise<{ readonly plan: DispatchPlan; readonly modelUsed: string }> {
  const fallback = {
    plan: { probes: [] } as DispatchPlan,
    modelUsed: recipeModelName(ctx.input),
  };
  if (lease.maxTurns <= 0) return fallback;
  try {
    const run = await withNodeTrajectory(segments, AGENT_NAME, "survey", () =>
      runRecipeSurvey(ctx, deps, availableTurns, lease),
    );
    budget.settle(lease, { costUsd: run.costUsd, numTurns: run.numTurns });
    segments.push(toRecipeRunSegment(run, "survey"));
    const chosen =
      run.data.probes.map(({ probe, weight }) => `${probe}:${weight}`).join(", ") || "no specialists";
    pushRouteSelected(segments, "survey", `survey -> ${chosen}`);
    return { plan: run.data, modelUsed: run.modelUsed };
  } catch (error) {
    const accounting = agentFailureAccounting(error);
    budget.settle(lease, {
      costUsd: accounting.costUsd,
      numTurns: accounting.numTurns,
    });
    segments.push({ accounting, steps: [], nodeName: "survey" });
    return fallback;
  }
}

export async function dispatchRecipeProbes(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  budget: ExecutionBudget,
  plan: DispatchPlan,
  coordinatorLedger: ProvenanceLedger,
  segments: RecipeRunSegment[],
): Promise<ProbeReport[]> {
  const leases = budget.leaseMany(
    plan.probes.map(({ weight }) => weight),
    1,
  );
  const runs = await Promise.all(
    plan.probes.map((assignment, index) =>
      withNodeTrajectory(segments, AGENT_NAME, "probe", () =>
        runRecipeProbe(
          ctx,
          deps,
          assignment,
          leases[index]!,
          plan.probes.filter((other) => other.probe !== assignment.probe),
        ),
      ),
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
      nodeName: `probe:${run.report.probe}`,
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
  segments: RecipeRunSegment[],
): Promise<RecipeSynthesisRun> {
  const lease = budget.combine([floorLease, budget.lease(1)]);
  const prompt = buildRecipeUserPrompt(
    ctx.prompt,
    ctx.input.taskId,
    ctx.input.userPrompt,
    ctx.input.language,
    plan,
    reports,
  );
  const run = await withNodeTrajectory(segments, AGENT_NAME, "investigate", () =>
    runRecipeSynthesis(ctx, deps, coordinatorLedger, prompt, lease, "investigate"),
  );
  budget.settle(lease, { costUsd: run.costUsd, numTurns: run.numTurns });
  segments.push(toRecipeRunSegment(run, "investigate"));
  return run;
}

export function toRecipeRunSegment(
  run: StructuredQueryResult<unknown>,
  nodeName: string,
): RecipeRunSegment {
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
