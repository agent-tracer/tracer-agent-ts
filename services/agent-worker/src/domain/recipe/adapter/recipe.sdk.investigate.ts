import {
  type StructuredQueryResult,
} from "@tracer-agent/llm";
import { type AgentBudgetLease } from "~agent-worker/support/llm/agent.budget.js";
import {
  buildRecipeSystemPrompt,
} from "~agent-worker/domain/recipe/model/recipe.prompt.js";
import {
  RECIPE_COORDINATOR_TOOLS,
  SYNTHESIS_WALL_CLOCK_MS,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.policy.js";
import {
  recipeSynthesisSchema,
  type RecipeSynthesis,
} from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import type { ProvenanceLedger } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import {
  buildRecipeToolHandlers,
  type RecipeToolDeps,
} from "./recipe.tools.js";
import {
    RECIPE_SCAN_SPEC,
    runRecipeQuery,
    type RecipeQueryContext,
} from "./recipe.sdk.query.js";

export type RecipeSynthesisRun = StructuredQueryResult<RecipeSynthesis>;

/** 종합(조율자 단독 조사 포함)과 수리가 공유하는, 전체 도구와 합쳐진 장부로 도는 호출이다. */
export function runRecipeSynthesis(
  ctx: RecipeQueryContext,
  deps: RecipeToolDeps,
  ledger: ProvenanceLedger,
  prompt: string,
  lease: AgentBudgetLease,
  label: string,
): Promise<RecipeSynthesisRun> {
  const systemPrompt = buildRecipeSystemPrompt(ctx.prompt);
  return runRecipeQuery(ctx, {
    label: `${RECIPE_SCAN_SPEC.name}:${label}`,
    prompt,
    systemPrompt,
    toolNames: RECIPE_COORDINATOR_TOOLS,
    handlers: buildRecipeToolHandlers(ctx.input.userId, deps, ledger),
    outputSchema: recipeSynthesisSchema,
    lease,
    deadlineMs: SYNTHESIS_WALL_CLOCK_MS,
  });
}
