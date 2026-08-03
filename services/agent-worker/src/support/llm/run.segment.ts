import {
    JOB_STEP_ORCHESTRATION_EVENT_KIND,
    JOB_STEP_ROLE,
    type JobStepOrchestrationEventKind,
    type JobStepPayload,
} from "@tracer-agent/llm";
import type { AgentCallAccounting } from "~agent-worker/support/llm/agent.accounting.js";

/** 실행이 밟는 노드의 이름이며 관측은 이 이름으로만 수리 여부를 읽는다. */
export const AGENT_NODE = {
    survey: "survey",
    triage: "triage",
    inspect: "inspect",
    probe: "probe",
    investigate: "investigate",
    repair: "repair",
} as const;

export type AgentNodeName = (typeof AGENT_NODE)[keyof typeof AGENT_NODE];

/** 호출 하나나 궤적 사건 하나가 남긴 조각이며 병합 후 이 이름이 각 스텝의 노드로 새겨진다. */
export interface RunSegment {
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly JobStepPayload[];
    readonly nodeName: string;
}

const ZERO_ACCOUNTING = { durationMs: 0, costUsd: null, numTurns: null, usage: null } as const;

/** 팬아웃한 일꾼 하나의 노드 이름이며 맡은 갈래를 이름에 싣는다. */
export function fanOutNode(node: AgentNodeName, branch: string): string {
    return `${node}:${branch}`;
}

/** 이 실행이 수리를 시도했는지는 궤적에 수리 노드가 있었는지로 정한다. */
export function attemptedRepair(segments: readonly { readonly nodeName: string }[]): boolean {
    return segments.some(({ nodeName }) => nodeName === AGENT_NODE.repair);
}

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
    segments: RunSegment[],
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

/** 조율자가 어느 일꾼을 얼마나 골랐는지 궤적에 남긴다. */
export function pushRouteSelected(segments: RunSegment[], nodeName: string, content: string): void {
    pushEvent(segments, nodeName, JOB_STEP_ORCHESTRATION_EVENT_KIND.routeSelected, content);
}

/** 검증이 걸어낸 사유를 궤적에 남긴다. */
export function pushValidationFailed(segments: RunSegment[], nodeName: string, content: string): void {
    pushEvent(segments, nodeName, JOB_STEP_ORCHESTRATION_EVENT_KIND.validationFailed, content);
}

/** 노드 하나를 감싸 진입과 완료와 실패를 궤적에 남기며, 무너지면 실패를 남긴 뒤 그대로 다시 던진다. */
export async function withNodeTrajectory<T>(
    segments: RunSegment[],
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
