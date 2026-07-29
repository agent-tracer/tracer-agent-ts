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
import type { RecipeRunSegment } from "./recipe.sdk.orchestration.js";

export function buildRecipeOutput(
  ctx: RecipeQueryContext,
  segments: readonly RecipeRunSegment[],
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
  const fragmentIntegrity = ctx.fragmentResolver?.finalizeBundle(
    Object.fromEntries(ctx.renderedTemplates),
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
      promptVersion: input.prompt.versionId,
      promptFingerprint: {
        agent: RECIPE_SCAN_SPEC.name,
        version: input.prompt.semanticVersion,
        language: input.language,
        contentHash: input.prompt.contentHash,
      },
      toolContractVersion: input.prompt.toolContractVersion,
      durationMs: accounting.durationMs,
      costUsd: accounting.costUsd,
      usage: accounting.usage,
      steps,
      landed: false,
      repairAttempted: segments.some(({ nodeName }) => nodeName === "repair"),
      validationPassed: true,
      ...(fragmentIntegrity ?? {}),
    }),
  };
}
