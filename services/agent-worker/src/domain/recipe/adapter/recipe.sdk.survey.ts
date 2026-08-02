import {
  type StructuredQueryResult,
} from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import {
  RECIPE_SURVEY_TOOLS,
  SURVEY_WALL_CLOCK_MS,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.policy.js";
import { buildRecipeToolHandlers, type RecipeToolDeps } from "./recipe.tools.js";
import {
  buildRecipeSurveyPrompt,
  buildRecipeSurveySystemPrompt,
} from "~agent-worker/domain/recipe/model/recipe.prompt.js";
import {
  dispatchPlanSchema,
  type DispatchPlan,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import {
    RECIPE_SCAN_SPEC,
    runRecipeQuery,
    type RecipeQueryContext,
} from "./recipe.sdk.query.js";

/** 조율자가 도구 없이 이번 조사를 어디에 얼마나 배분할지 스스로 정하게 한다. */
export function runRecipeSurvey(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  availableTurns: number,
  lease: AgentBudgetLease,
): Promise<StructuredQueryResult<DispatchPlan>> {
  const systemPrompt = buildRecipeSurveySystemPrompt(ctx.prompt);
  return runRecipeQuery(ctx, {
    label: `${RECIPE_SCAN_SPEC.name}:survey`,
    prompt: buildRecipeSurveyPrompt(
      ctx.prompt,
      ctx.input.taskId,
      ctx.input.userPrompt,
      availableTurns,
    ),
    systemPrompt,
    toolNames: RECIPE_SURVEY_TOOLS,
    handlers: buildRecipeToolHandlers(ctx.input.userId, deps),
    outputSchema: dispatchPlanSchema,
    lease,
    deadlineMs: SURVEY_WALL_CLOCK_MS,
  });
}
