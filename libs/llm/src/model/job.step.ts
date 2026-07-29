/** 궤적 한 줄을 남긴 주체이며 값은 계약의 잡 단계 어휘가 소유한다. */
export const JOB_STEP_ROLE = {
    system: "system",
    user: "user",
    assistant: "assistant",
    tool: "tool",
    graph: "graph",
} as const;

export type JobStepRole = (typeof JOB_STEP_ROLE)[keyof typeof JOB_STEP_ROLE];

export const JOB_STEP_ROLES = [
    JOB_STEP_ROLE.system,
    JOB_STEP_ROLE.user,
    JOB_STEP_ROLE.assistant,
    JOB_STEP_ROLE.tool,
    JOB_STEP_ROLE.graph,
] as const satisfies readonly JobStepRole[];

/** 그래프 실행이 남기는 사건의 종류이며 값은 계약의 잡 단계 어휘가 소유한다. */
export const JOB_STEP_GRAPH_EVENT_KIND = {
    nodeStarted: "node.started",
    nodeCompleted: "node.completed",
    nodeFailed: "node.failed",
    routeSelected: "route.selected",
    validationFailed: "validation.failed",
} as const;

export type JobStepGraphEventKind =
    (typeof JOB_STEP_GRAPH_EVENT_KIND)[keyof typeof JOB_STEP_GRAPH_EVENT_KIND];

export interface JobStepToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

// 언어별 실행기는 언어 중립 실행 어휘 계약으로 필드의 의미를 맞춘다.
export interface JobStepPayload {
    readonly seq: number;
    readonly role: JobStepRole;
    readonly content: string;
    readonly truncated: boolean;
    readonly toolCalls: readonly JobStepToolCall[];
    readonly toolName?: string | undefined;
    readonly toolCallId?: string | undefined;
    readonly inputTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
    readonly cacheReadTokens?: number | undefined;
    readonly cacheCreationTokens?: number | undefined;
    readonly stopReason?: string | undefined;
    readonly nodeName?: string | undefined;
    readonly eventKind?: JobStepGraphEventKind | undefined;
    readonly durationMs?: number | undefined;
}

export interface RecordedJobStep extends JobStepPayload {
    readonly attempt: number;
}

// 백엔드가 실제로 내보내는 빈 스텝은 궤적에 아무 의미도 싣지 못하므로 저장하지 않는다.
export function jobStepCarriesContent(step: JobStepPayload): boolean {
    return step.content.trim().length > 0 || step.toolCalls.length > 0;
}

/** 저장 식별자가 확정된 궤적 스텝이다. */
export interface GeneratedJobStep extends JobStepPayload {
    readonly id: string;
}

/** 저장할 내용이 있는 궤적 스텝에만 식별자를 부여한다. */
export function assignStepIds(
    steps: readonly JobStepPayload[],
    nextId: () => string,
): readonly GeneratedJobStep[] {
    return steps.filter((step) => jobStepCarriesContent(step)).map((step) => ({ ...step, id: nextId() }));
}

/** 오케스트레이션 엔진이 준 이번 시도의 실행 맥락이다. */
export interface AgentAttemptRun {
    readonly attempt: number;
    readonly idempotencyKey: string;
    readonly abortSignal: AbortSignal;
}
