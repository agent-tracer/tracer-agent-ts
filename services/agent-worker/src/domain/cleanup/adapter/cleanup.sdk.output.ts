import { attemptedRepair, type RunSegment } from "~agent-worker/support/llm/run.segment.js";
import { mergeAgentTrajectory } from "@tracer-agent/llm";
import type { CleanupSuggestionPayload } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.schema.js";
import type { GenerateCleanupSuggestionsInput, GenerateCleanupSuggestionsOutput } from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { mergeAgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import { buildSuccessfulRunObservation } from "~agent-worker/support/llm/run.observation.js";
import { cleanupModelName, TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";

export function buildCleanupOutput(
    ctx: CleanupQueryContext,
    segments: readonly RunSegment[],
    suggestions: readonly CleanupSuggestionPayload[],
    modelUsed: string,
): GenerateCleanupSuggestionsOutput {
    const input: GenerateCleanupSuggestionsInput = ctx.input;
    const accounting = mergeAgentCallAccounting(segments.map((segment) => segment.accounting));
    const steps = mergeAgentTrajectory(segments.map((segment) => ({ nodeName: segment.nodeName, steps: segment.steps })));

    return {
        suggestions,
        modelUsed,
        durationMs: accounting.durationMs,
        costUsd: accounting.costUsd,
        numTurns: accounting.numTurns,
        usage: accounting.usage,
        steps,
        observation: buildSuccessfulRunObservation({
            executionId: input.jobId,
            attempt: input.attempt,
            jobId: input.jobId,
            agentName: TASK_CLEANUP_SPEC.name,
            modelRequested: cleanupModelName(input),
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
