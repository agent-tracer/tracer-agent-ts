/** 사용자가 접수할 수 있는 잡의 종류이며 값은 계약의 잡 어휘가 소유한다. */
export const JOB_KIND = {
    titleSuggestion: "title.suggestion",
    recipeScan: "recipe.scan",
    taskCleanup: "task.cleanup",
} as const;

export type JobKind = (typeof JOB_KIND)[keyof typeof JOB_KIND];

/** 잡 하나를 실제로 실행하는 주체이며 이 축의 잡은 모두 워크플로가 실행한다. */
export const JOB_EXECUTOR = {
    [JOB_KIND.titleSuggestion]: "temporal",
    [JOB_KIND.recipeScan]: "temporal",
    [JOB_KIND.taskCleanup]: "temporal",
} as const satisfies Record<JobKind, "temporal">;

export type JobExecutor = (typeof JOB_EXECUTOR)[JobKind];

export const JOB_STATUS = {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    canceled: "canceled",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// canceled를 종료 상태에 포함해야 워커의 종결 가드가 취소된 잡을 덮어쓰지 않는다.
export function isTerminalJobStatus(status: JobStatus): boolean {
    return status === JOB_STATUS.completed || status === JOB_STATUS.failed || status === JOB_STATUS.canceled;
}

export function isCancelableJobStatus(status: JobStatus): boolean {
    return status === JOB_STATUS.pending || status === JOB_STATUS.running;
}

/** 종결 전이가 다른 실행에 밀려 원장에 닿지 못했음을 알리며 활동은 이것을 실패로 보지 않는다. */
export class JobTransitionLostError extends Error {
    constructor(readonly jobId: string) {
        super(`job transition lost: ${jobId}`);
        this.name = "JobTransitionLostError";
    }
}

export function isJobTransitionLost(error: unknown): error is JobTransitionLostError {
    return error instanceof JobTransitionLostError;
}
