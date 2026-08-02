import {
    AGENT_BACKEND,
    isBudgetExhaustedFailure,
    type ClaudeQueryOptions,
    type IQueryRunner,
    withInvokeAgentTelemetry,
} from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { JOB_KIND } from "~agent-worker/support/job.const.js";
import { ExecutionBudget } from "~agent-worker/support/llm/agent.budget.js";
import {
  buildRecipeRepairPrompt,
  buildRecipeUserPrompt,
} from "~agent-worker/domain/recipe/model/recipe.prompt.js";
import {
  MAX_REDISPATCH_ROUNDS,
  type DispatchPlan,
  type RecipeSynthesis,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import {
  MIN_SYNTHESIS_TURNS,
  REPAIR_RESERVED_BUDGET_SHARE,
  REPAIR_RESERVED_TURNS,
  SURVEY_BUDGET_SHARE,
  SURVEY_TURNS,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.policy.js";
import { ProvenanceLedger } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { validateRecipeCandidates } from "~agent-worker/domain/recipe/model/recipe.validation.model.js";
import type {
  GenerateRecipeCandidatesInput,
  GenerateRecipeCandidatesOutput,
  RecipeAgentPort,
} from "~agent-worker/domain/recipe/port/recipe.agent.port.js";
import type { PromptSourcePort } from "~agent-worker/domain/recipe/port/prompt.source.port.js";
import type { RecipeToolDeps } from "./recipe.tools.js";
import { RECIPE_SCAN_SPEC, type RecipeQueryContext } from "./recipe.sdk.query.js";
import {
  runRecipeSynthesis,
  type RecipeSynthesisRun,
} from "./recipe.sdk.investigate.js";
import {
  dispatchRecipeProbes,
  runRecipeSurveyPhase,
  synthesizeRecipe,
  toRecipeRunSegment,
  type RecipeRunSegment,
} from "./recipe.sdk.orchestration.js";
import { buildRecipeOutput } from "./recipe.sdk.output.js";
import { pushValidationFailed, withNodeTrajectory } from "./recipe.node.trace.js";

const VALIDATE_NODE = "validate_candidate";

export {
  RECIPE_COORDINATOR_TOOLS,
  RECIPE_WORKER_MAX_TURNS,
  RECIPE_PROBE_TOOL_NAMES as RECIPE_WORKER_TOOLS,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.policy.js";

/** 조율자에게 계약 총량에서 수리와 계획 몫을 뺀 조사 가능 턴을 알려 준다. */
const SURVEY_AVAILABLE_TURNS =
  RECIPE_SCAN_SPEC.limits.maxTurns - REPAIR_RESERVED_TURNS - SURVEY_TURNS;

type RunSegment = RecipeRunSegment;

/** Claude Agent SDK 방언으로 recipe 명세를 렌더링해, 계획 → 팬아웃 → 종합 → 검증 → 수리로 실행한다. */
export class RecipeAgentAdapter implements RecipeAgentPort {
  constructor(
    private readonly runner: IQueryRunner<ClaudeQueryOptions>,
    private readonly deps: RecipeToolDeps,
    private readonly prompts: PromptSourcePort,
  ) {}

  requiresLocalApiKey(): boolean {
    return this.runner.requiresLocalApiKey();
  }

  async generate(
    input: GenerateRecipeCandidatesInput,
  ): Promise<GenerateRecipeCandidatesOutput> {
    return withInvokeAgentTelemetry(
      {
        jobId: input.jobId,
        jobKind: JOB_KIND.recipeScan,
        agentName: AGENT.recipeScan.id,
        backend: AGENT_BACKEND,
        ...(input.model !== undefined ? { model: input.model } : {}),
      },
      () => this.runAgent(input),
    );
  }

  private async runAgent(
    input: GenerateRecipeCandidatesInput,
  ): Promise<GenerateRecipeCandidatesOutput> {
    const ctx: RecipeQueryContext = {
      runner: this.runner,
      input,
      prompt: await this.prompts.resolve(AGENT.recipeScan.id),
    };
    const { limits } = RECIPE_SCAN_SPEC;
    const budget = new ExecutionBudget({
      maxBudgetUsd: limits.maxBudgetUsd,
      maxTurns: limits.maxTurns,
    });

    // 수리와 계획과 종합 몫을 먼저 예약해 전문가 배분에서 제외한다.
    const repairLease = budget.reserve(
      REPAIR_RESERVED_TURNS,
      REPAIR_RESERVED_BUDGET_SHARE,
    );
    const surveyLease = budget.reserve(SURVEY_TURNS, SURVEY_BUDGET_SHARE);
    const synthesisFloorLease = budget.reserve(MIN_SYNTHESIS_TURNS, 0);

    const segments: RunSegment[] = [];
    const { plan, modelUsed } = await runRecipeSurveyPhase(
      ctx,
      this.deps,
      budget,
      surveyLease,
      segments,
      SURVEY_AVAILABLE_TURNS,
    );

    const coordinatorLedger = new ProvenanceLedger();
    // 전문가가 없으면 근거 장부가 비어 있으므로 빈 결과를 반환한다.
    if (plan.probes.length === 0)
      return buildRecipeOutput(ctx, segments, [], modelUsed, coordinatorLedger);

    const reports = await dispatchRecipeProbes(
      ctx,
      this.deps,
      budget,
      plan,
      coordinatorLedger,
      segments,
    );

    let synthesis = await synthesizeRecipe(
      ctx,
      this.deps,
      budget,
      synthesisFloorLease,
      plan,
      reports,
      coordinatorLedger,
      segments,
    );

    // 조율자가 근거 부족을 지목하면 남은 예산으로 전문가를 다시 호출하고 종합한다.
    for (
      let round = 0;
      round < MAX_REDISPATCH_ROUNDS &&
      wantsRedispatch(synthesis.data) &&
      budget.hasRemainingCapacity(MIN_SYNTHESIS_TURNS + 1);
      round += 1
    ) {
      const redispatchFloorLease = budget.reserve(MIN_SYNTHESIS_TURNS, 0);
      const redispatchPlan: DispatchPlan = {
        probes: synthesis.data.redispatch,
      };
      reports.push(
        ...(await dispatchRecipeProbes(
          ctx,
          this.deps,
          budget,
          redispatchPlan,
          coordinatorLedger,
          segments,
        )),
      );
      synthesis = await synthesizeRecipe(
        ctx,
        this.deps,
        budget,
        redispatchFloorLease,
        plan,
        reports,
        coordinatorLedger,
        segments,
      );
    }

    const errors = await withNodeTrajectory(segments, AGENT.recipeScan.id, VALIDATE_NODE, () =>
      Promise.resolve(
        validateRecipeCandidates(synthesis.data.recipes, input.taskId, coordinatorLedger.snapshot()),
      ),
    );
    if (errors.length > 0) pushValidationFailed(segments, VALIDATE_NODE, errors.join("; "));
    if (errors.length === 0)
      return buildRecipeOutput(
        ctx,
        segments,
        synthesis.data.recipes,
        synthesis.modelUsed,
        coordinatorLedger,
      );

    // 예약한 턴이 없으면 수리를 시도하지 않고 빈 결과를 반환한다.
    if (repairLease.maxTurns <= 0)
      return buildRecipeOutput(
        ctx,
        segments,
        [],
        synthesis.modelUsed,
        coordinatorLedger,
      );

    const investigatePrompt = buildRecipeUserPrompt(
      ctx.prompt,
      input.taskId,
      input.userPrompt,
      input.language,
      plan,
      reports,
    );
    let repaired: RecipeSynthesisRun;
    try {
      const repairPrompt = buildRecipeRepairPrompt(
        ctx.prompt,
        investigatePrompt,
        synthesis.data,
        errors,
      );
      repaired = await withNodeTrajectory(segments, AGENT.recipeScan.id, "repair", () =>
        runRecipeSynthesis(ctx, this.deps, coordinatorLedger, repairPrompt, repairLease, "repair"),
      );
    } catch (error) {
      // 수리 호출이 예산을 소진하면 잡을 실패시키지 않고 빈 결과를 반환한다.
      if (isBudgetExhaustedFailure(error))
        return buildRecipeOutput(
          ctx,
          segments,
          [],
          synthesis.modelUsed,
          coordinatorLedger,
        );
      throw error;
    }
    budget.settle(repairLease, {
      costUsd: repaired.costUsd,
      numTurns: repaired.numTurns,
    });
    segments.push(toRecipeRunSegment(repaired, "repair"));

    const remaining = await withNodeTrajectory(segments, AGENT.recipeScan.id, VALIDATE_NODE, () =>
      Promise.resolve(
        validateRecipeCandidates(repaired.data.recipes, input.taskId, coordinatorLedger.snapshot()),
      ),
    );
    if (remaining.length > 0) pushValidationFailed(segments, VALIDATE_NODE, remaining.join("; "));
    return buildRecipeOutput(
      ctx,
      segments,
      remaining.length === 0 ? repaired.data.recipes : [],
      repaired.modelUsed,
      coordinatorLedger,
    );
  }
}

// 산출 배타를 스키마가 강제하므로 redispatch가 채워졌다면 recipes는 이미 비어 있다.
function wantsRedispatch(synthesis: RecipeSynthesis): boolean {
  return synthesis.redispatch.length > 0;
}
