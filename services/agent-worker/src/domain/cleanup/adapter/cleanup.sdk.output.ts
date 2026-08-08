import { attemptedRepair, pushEmptyResult, type RunSegment } from "~agent-worker/support/llm/run.segment.js";
import {
    EMPTY_RESULT_NODE,
    renderEmptyResultReason,
    type EmptyResultReason,
} from "~agent-worker/support/llm/empty.result.js";
import { mergeAgentTrajectory } from "@tracer-agent/llm";
import type { CleanupSuggestionPayload } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.schema.js";
import type { GenerateCleanupSuggestionsInput, GenerateCleanupSuggestionsOutput } from "~agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { mergeAgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";
import { buildSuccessfulRunObservation } from "~agent-worker/support/llm/run.observation.js";
import { cleanupModelName, TASK_CLEANUP_SPEC, type CleanupQueryContext } from "./cleanup.sdk.query.js";

/** 검증이 실제로 어떻게 끝났는지이며 원장은 이 값으로 옳은 빈 답과 검증 실패를 구분한다. */
export interface CleanupValidationOutcome {
    readonly passed: boolean;
    readonly errorCodes?: readonly string[];
}

/** 제안 없이 끝나는 실행이며 왜 비었는지를 궤적에 남긴 뒤 빈 산출을 만든다. */
export function buildEmptyCleanupOutput(
    ctx: CleanupQueryContext,
    segments: RunSegment[],
    modelUsed: string,
    validation: CleanupValidationOutcome,
    reason: EmptyResultReason,
): GenerateCleanupSuggestionsOutput {
    pushEmptyResult(segments, EMPTY_RESULT_NODE, renderEmptyResultReason(reason));
    return buildCleanupOutput(ctx, segments, [], modelUsed, validation);
}

export function buildCleanupOutput(
    ctx: CleanupQueryContext,
    segments: readonly RunSegment[],
    suggestions: readonly CleanupSuggestionPayload[],
    modelUsed: string,
    validation: CleanupValidationOutcome,
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
            // 종료로 끝난 호출이 하나라도 있으면 이 실행은 예산이 다해 결론만 받은 실행이다.
            landed: segments.some((segment) => segment.landed === true),
            repairAttempted: attemptedRepair(segments),
            validationPassed: validation.passed,
            ...(validation.errorCodes !== undefined ? { validationErrorCodes: validation.errorCodes } : {}),
        }),
    };
}
