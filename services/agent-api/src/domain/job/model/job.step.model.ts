/** 궤적 한 줄을 남긴 주체이며 값은 계약의 잡 단계 어휘가 소유한다. */
export const JOB_STEP_ROLES = ["system", "user", "assistant", "tool", "orchestration"] as const;

export type JobStepRole = (typeof JOB_STEP_ROLES)[number];

/** 그래프 실행이 남기는 사건의 종류이며 값은 계약의 잡 단계 어휘가 소유한다. */
export const JOB_STEP_EVENT_KINDS = [
    "node.started",
    "node.completed",
    "node.failed",
    "route.selected",
    "validation.failed",
] as const;

export type JobStepEventKind = (typeof JOB_STEP_EVENT_KINDS)[number];

/** 모델이 한 단계에서 제안한 도구 호출이다. */
export interface JobStepToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

/** 잡 하나가 부른 모델과 도구의 궤적 한 줄이다. */
export interface JobStep {
    readonly id: string;
    readonly jobId: string;
    readonly userId: string;
    /** 실행 재시도 회차이며, 시도마다 seq가 0부터 다시 시작해도 이 값으로 분리된다. */
    readonly attempt: number;
    readonly seq: number;
    readonly role: JobStepRole;
    readonly content: string;
    readonly truncated: boolean;
    readonly toolCalls: readonly JobStepToolCall[] | null;
    readonly toolName: string | null;
    readonly toolCallId: string | null;
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
    readonly cacheReadTokens: number | null;
    readonly cacheCreationTokens: number | null;
    readonly stopReason: string | null;
    readonly nodeName: string | null;
    readonly eventKind: JobStepEventKind | null;
    readonly durationMs: number | null;
    readonly createdAt: Date;
}
