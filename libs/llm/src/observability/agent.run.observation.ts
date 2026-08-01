import { AGENT_BACKEND } from "~llm/model/agent.backend.js";
import {
    AGENT_CALL_STATUS,
    AGENT_RUN_OBSERVATION_STATUS,
    type AgentAttemptIdentity,
    type AgentRunObservation,
    type ToolCallObservation,
    type ValidationObservation,
} from "~llm/model/agent.observation.js";
import { JOB_STEP_ROLE, type JobStepPayload } from "~llm/model/job.step.js";
import type { AgentQueryResult } from "~llm/runner/llm.runner.js";

export interface ClaudeObservationInput extends AgentAttemptIdentity {
    readonly jobId?: string;
    readonly agentName: string;
    readonly modelRequested: string;
    readonly promptVersion: string;
    readonly promptContentHash: string;
    readonly toolContractVersion: string;
    readonly modelCallId?: string;
    readonly repairAttempted: boolean;
    readonly validation: ValidationObservation;
}

/** 실행 결과를 원문 prompt와 도구 인자와 도구 결과 없이 비교 가능한 관측 레코드로 정규화한다. */
export function buildClaudeRunObservation(
    input: ClaudeObservationInput,
    result: AgentQueryResult,
): AgentRunObservation {
    const status = statusOf(result.errorSubtype);
    const usage = normalizeUsage(result);
    const identity = { executionId: input.executionId, attemptId: input.attemptId };
    return {
        ...identity,
        jobId: input.jobId ?? null,
        agentName: input.agentName,
        backend: AGENT_BACKEND.claudeSdk,
        modelRequested: input.modelRequested,
        modelActual: result.actualModel,
        promptVersion: input.promptVersion,
        promptContentHash: input.promptContentHash,
        toolContractVersion: input.toolContractVersion,
        status,
        durationMs: result.durationMs,
        usage,
        costUsd: result.costUsd,
        landed: result.landed,
        repairAttempted: input.repairAttempted,
        validation: input.validation,
        modelCalls: input.modelCallId === undefined
            ? []
            : [{
                ...identity,
                modelCallId: input.modelCallId,
                providerRequestId: result.providerRequestId,
                modelRequested: input.modelRequested,
                modelActual: result.actualModel,
                status: callStatusOf(status),
                durationMs: result.durationMs,
                usage,
                costUsd: result.costUsd,
                finishReason: lastFinishReason(result.steps),
                errorType: result.errorSubtype,
            }],
        toolCalls: buildToolCallObservations(result.steps, identity, status),
    };
}

function normalizeUsage(result: AgentQueryResult) {
    return {
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        cacheReadTokens: result.usage?.cacheReadTokens ?? 0,
        cacheWriteTokens: result.usage?.cacheCreationTokens ?? 0,
    };
}

function statusOf(errorSubtype: string | null) {
    if (errorSubtype === null) return AGENT_RUN_OBSERVATION_STATUS.succeeded;
    if (errorSubtype === "cancelled") return AGENT_RUN_OBSERVATION_STATUS.cancelled;
    return AGENT_RUN_OBSERVATION_STATUS.failed;
}

function callStatusOf(status: AgentRunObservation["status"]) {
    if (status === AGENT_RUN_OBSERVATION_STATUS.succeeded) return AGENT_CALL_STATUS.succeeded;
    if (status === AGENT_RUN_OBSERVATION_STATUS.cancelled) return AGENT_CALL_STATUS.cancelled;
    return AGENT_CALL_STATUS.failed;
}

function lastFinishReason(steps: readonly JobStepPayload[]): string | null {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
        const reason = steps[index]?.stopReason;
        if (reason !== undefined) return reason;
    }
    return null;
}

/** 궤적 스냅샷에서 payload를 버리고 도구 호출 종결 요약만 만든다. */
export function buildToolCallObservations(
    steps: readonly JobStepPayload[],
    identity: AgentAttemptIdentity,
    runStatus: AgentRunObservation["status"],
): readonly ToolCallObservation[] {
    const names = new Map<string, string>();
    for (const step of steps) {
        for (const call of step.toolCalls) names.set(call.id, call.name);
    }
    const completed = new Set<string>();
    const observations: ToolCallObservation[] = [];
    for (const step of steps) {
        if (step.role !== JOB_STEP_ROLE.tool || step.toolCallId === undefined) continue;
        const toolName = step.toolName ?? names.get(step.toolCallId);
        if (toolName === undefined || toolName.length === 0) continue;
        completed.add(step.toolCallId);
        observations.push({
            ...identity,
            toolCallId: step.toolCallId,
            toolName,
            status: AGENT_CALL_STATUS.succeeded,
            durationMs: step.durationMs ?? 0,
            errorType: null,
        });
    }
    for (const [toolCallId, toolName] of names) {
        if (completed.has(toolCallId)) continue;
        observations.push({
            ...identity,
            toolCallId,
            toolName,
            status: callStatusOf(runStatus),
            durationMs: 0,
            errorType: runStatus === AGENT_RUN_OBSERVATION_STATUS.succeeded ? null : "incomplete_tool_call",
        });
    }
    return observations;
}
