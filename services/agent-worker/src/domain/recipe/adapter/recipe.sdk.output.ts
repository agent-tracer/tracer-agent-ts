import { attemptedRepair, pushRouteSelected, type RunSegment } from "~agent-worker/support/llm/run.segment.js";
import {
    recipeEmptyResultReason,
    renderEmptyResultReason,
    type RecipeEmptyResultSignals,
} from "~agent-worker/domain/recipe/model/recipe.outcome.model.js";
import { mergeAgentTrajectory } from "@tracer-agent/llm";
import type { RecipeCandidatePayload } from "~agent-worker/domain/recipe/model/recipe.scan.schema.js";
import type { GenerateRecipeCandidatesOutput } from "~agent-worker/domain/recipe/port/recipe.agent.port.js";
import { mergeAgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import { buildSuccessfulRunObservation } from "~agent-worker/support/llm/run.observation.js";
import type { ProvenanceLedger } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import {
    RECIPE_SCAN_SPEC,
    recipeModelName,
  type RecipeQueryContext,
} from "./recipe.sdk.query.js";

/** 빈 결과의 사유를 남기는 자리이며 어느 단계에서 비었든 이 한 이름으로 궤적에 선다. */
const EMPTY_RESULT_NODE = "empty_result";

/** 후보 없이 끝나는 실행이며 왜 비었는지를 궤적에 남긴 뒤 빈 산출을 만든다. */
export function buildEmptyRecipeOutput(
  ctx: RecipeQueryContext,
  segments: RunSegment[],
  modelUsed: string,
  ledger: ProvenanceLedger,
  signals: RecipeEmptyResultSignals,
): GenerateRecipeCandidatesOutput {
  pushRouteSelected(segments, EMPTY_RESULT_NODE, renderEmptyResultReason(recipeEmptyResultReason(signals)));
  return buildRecipeOutput(ctx, segments, [], modelUsed, ledger);
}

export function buildRecipeOutput(
  ctx: RecipeQueryContext,
  segments: readonly RunSegment[],
  recipes: readonly RecipeCandidatePayload[],
  modelUsed: string,
  ledger: ProvenanceLedger,
): GenerateRecipeCandidatesOutput {
  const input = ctx.input;
  const accounting = mergeAgentCallAccounting(
    segments.map((segment) => segment.accounting),
  );
  const steps = mergeAgentTrajectory(
    segments.map((segment) => ({
      nodeName: segment.nodeName,
      steps: segment.steps,
    })),
  );

  return {
    recipes,
    modelUsed,
    durationMs: accounting.durationMs,
    costUsd: accounting.costUsd,
    numTurns: accounting.numTurns,
    usage: accounting.usage,
    steps,
    provenance: ledger.snapshot(),
    observation: buildSuccessfulRunObservation({
      executionId: input.jobId,
      attempt: input.attempt,
      jobId: input.jobId,
      agentName: RECIPE_SCAN_SPEC.name,
      modelRequested: recipeModelName(input),
      modelActual: modelUsed,
      promptVersion: input.prompt.promptVersion,
      toolContractVersion: input.prompt.toolContractVersion,
      durationMs: accounting.durationMs,
      costUsd: accounting.costUsd,
      usage: accounting.usage,
      steps,
      landed: false,
      repairAttempted: attemptedRepair(segments),
      validationPassed: true,
    }),
  };
}
