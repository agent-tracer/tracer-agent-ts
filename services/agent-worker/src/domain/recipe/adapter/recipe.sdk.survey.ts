import {
  zodToClaudeOutputSchema,
  type StructuredQueryResult,
} from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
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
  availableTurns: number,
  lease: AgentBudgetLease,
): Promise<StructuredQueryResult<DispatchPlan>> {
  const systemPrompt = buildRecipeSurveySystemPrompt(ctx.prompt);
  ctx.renderedTemplates.set("recipe-scan.survey.system", systemPrompt);
  return runRecipeQuery(ctx, {
    label: `${RECIPE_SCAN_SPEC.name}:survey`,
    prompt: buildRecipeSurveyPrompt(
      ctx.input.taskId,
      ctx.input.userPrompt,
      availableTurns,
    ),
    systemPrompt,
    toolNames: [],
    toolSpecs: [],
    handlers: {},
    outputSchema: dispatchPlanSchema,
    claudeOutputSchema: zodToClaudeOutputSchema(dispatchPlanSchema),
    lease,
  });
}
