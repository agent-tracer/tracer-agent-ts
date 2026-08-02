import {
    JOB_STEP_ORCHESTRATION_EVENT_KIND,
    JOB_STEP_ROLE,
    type JobStepOrchestrationEventKind,
    type JobStepPayload,
} from "@tracer-agent/llm";
import type { AgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";

/** 호출 하나나 궤적 사건 하나가 남긴 조각이며 병합 후 이 이름이 각 스텝의 노드로 새겨진다. */
export interface RecipeRunSegment {
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly JobStepPayload[];
    readonly nodeName: string;
}

const ZERO_ACCOUNTING = { durationMs: 0, costUsd: null, numTurns: null, usage: null } as const;

function orchestrationStep(
    nodeName: string,
    eventKind: JobStepOrchestrationEventKind,
    content: string,
    durationMs?: number,
): JobStepPayload {
    return {
        seq: 0,
        role: JOB_STEP_ROLE.orchestration,
        content,
        truncated: false,
        toolCalls: [],
        nodeName,
        eventKind,
        ...(durationMs !== undefined ? { durationMs } : {}),
    };
}

function pushEvent(
    segments: RecipeRunSegment[],
    nodeName: string,
    eventKind: JobStepOrchestrationEventKind,
    content: string,
    durationMs?: number,
): void {
    segments.push({
        accounting: { ...ZERO_ACCOUNTING, ...(durationMs !== undefined ? { durationMs } : {}) },
        steps: [orchestrationStep(nodeName, eventKind, content, durationMs)],
        nodeName,
    });
}

/** 조율자가 어느 전문가를 얼마나 골랐는지 궤적에 남긴다. */
export function pushRouteSelected(segments: RecipeRunSegment[], nodeName: string, content: string): void {
    pushEvent(segments, nodeName, JOB_STEP_ORCHESTRATION_EVENT_KIND.routeSelected, content);
}

/** 검증이 걸어낸 사유를 궤적에 남긴다. */
export function pushValidationFailed(segments: RecipeRunSegment[], nodeName: string, content: string): void {
    pushEvent(segments, nodeName, JOB_STEP_ORCHESTRATION_EVENT_KIND.validationFailed, content);
}

/** 노드 하나를 감싸 진입과 완료와 실패를 궤적에 남기며, 무너지면 실패를 남긴 뒤 그대로 다시 던진다. */
export async function withNodeTrajectory<T>(
    segments: RecipeRunSegment[],
    agentName: string,
    nodeName: string,
    fn: () => Promise<T>,
): Promise<T> {
    pushEvent(segments, nodeName, JOB_STEP_ORCHESTRATION_EVENT_KIND.nodeStarted, `${agentName} entered ${nodeName}`);
    const startedAt = Date.now();
    try {
        const result = await fn();
        pushEvent(
            segments,
            nodeName,
            JOB_STEP_ORCHESTRATION_EVENT_KIND.nodeCompleted,
            `${agentName} completed ${nodeName}`,
            Date.now() - startedAt,
        );
        return result;
    } catch (error) {
        pushEvent(
            segments,
            nodeName,
            JOB_STEP_ORCHESTRATION_EVENT_KIND.nodeFailed,
            `${agentName} failed in ${nodeName}`,
            Date.now() - startedAt,
        );
        throw error;
    }
}
