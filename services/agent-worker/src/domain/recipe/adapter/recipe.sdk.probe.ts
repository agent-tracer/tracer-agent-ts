import type { JobStepPayload } from "@tracer-agent/llm";
import {
  AgentExecutionFailure,
} from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import { weightedWallClockMs } from "~agent-worker/support/llm/agent.deadline.js";
import { agentFailureAccounting, type AgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import {
  buildRecipeProbePrompt,
  buildRecipeProbeSystemPrompt,
} from "~agent-worker/domain/recipe/model/recipe.prompt.js";
import {
  probeReportSchema,
  type ProbeAssignment,
  type ProbeReport,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import {
  buildProbeFailureReport,
  probeToolNames,
  PROBE_MIN_WALL_CLOCK_FRACTION,
  PROBE_WALL_CLOCK_CEILING_MS,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.policy.js";
import { ProvenanceLedger } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import {
  buildRecipeToolHandlers,
  type RecipeToolDeps,
} from "./recipe.tools.js";
import {
    RECIPE_SCAN_SPEC,
    recipeModelName,
    runRecipeQuery,
    type RecipeQueryContext,
} from "./recipe.sdk.query.js";

/** 전문가 한 명이 자기 도구·자기 장부·자기 예산으로 조사한 결과다. */
export interface RecipeProbeRun {
  readonly report: ProbeReport;
  readonly ledger: ProvenanceLedger;
  readonly accounting: AgentCallAccounting;
  readonly steps: readonly JobStepPayload[];
}

/** 맡은 질문 하나를 자기 도구와 자기 장부로 조사하는 전문가를 실행하며, 실패해도 예외 대신 실패 보고로 하향해 다른 전문가의 성과를 지킨다. */
export async function runRecipeProbe(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  assignment: ProbeAssignment,
  lease: AgentBudgetLease,
  siblings: readonly ProbeAssignment[] = [],
): Promise<RecipeProbeRun> {
  const ledger = new ProvenanceLedger();
  const handlers = buildRecipeToolHandlers(ctx.input.userId, deps, ledger);
  const toolNames = probeToolNames(assignment.probe);
  const systemPrompt = buildRecipeProbeSystemPrompt(ctx.prompt);

  try {
    const run = await runRecipeQuery(ctx, {
      label: `${RECIPE_SCAN_SPEC.name}:probe:${assignment.probe}`,
      prompt: buildRecipeProbePrompt(
        ctx.prompt,
        ctx.input.taskId,
        assignment.question,
        lease.maxTurns,
        siblings,
      ),
      systemPrompt,
      toolNames,
      handlers,
      outputSchema: probeReportSchema,
      lease,
      deadlineMs: weightedWallClockMs(
        PROBE_WALL_CLOCK_CEILING_MS,
        lease.maxBudgetUsd,
        RECIPE_SCAN_SPEC.limits.maxBudgetUsd,
        PROBE_MIN_WALL_CLOCK_FRACTION,
      ),
    });
    return {
      report: run.data,
      ledger,
      accounting: {
        durationMs: run.durationMs,
        costUsd: run.costUsd,
        numTurns: run.numTurns,
        usage: run.usage,
      },
      steps: run.steps,
    };
  } catch (error) {
    return {
      report: buildProbeFailureReport(assignment.probe, error),
      ledger,
      accounting: agentFailureAccounting(error, recipeModelName(ctx.input)),
      steps: error instanceof AgentExecutionFailure ? error.steps : [],
    };
  }
}

