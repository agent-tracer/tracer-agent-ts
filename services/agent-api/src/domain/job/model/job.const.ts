/** 사용자가 접수할 수 있는 잡의 종류이며 값은 계약의 잡 어휘가 소유한다. */
export const JOB_KIND = {
    titleSuggestion: "title.suggestion",
    recipeScan: "recipe.scan",
    taskCleanup: "task.cleanup",
    ruleGeneration: "rule.generation",
} as const;

export type JobKind = (typeof JOB_KIND)[keyof typeof JOB_KIND];

export const JOB_KINDS: readonly JobKind[] = Object.values(JOB_KIND);

/** 잡 하나를 실제로 태우는 주체이며 워크플로가 도는 것과 플러그인이 궤적을 넘기는 것을 가른다. */
export const JOB_EXECUTOR = {
    [JOB_KIND.titleSuggestion]: "temporal",
    [JOB_KIND.recipeScan]: "temporal",
    [JOB_KIND.taskCleanup]: "temporal",
    [JOB_KIND.ruleGeneration]: "local",
} as const satisfies Record<JobKind, "temporal" | "local">;

export type JobExecutor = (typeof JOB_EXECUTOR)[JobKind];

export const JOB_STATUS = {
    pending: "pending",
    running: "running",
    completed: "completed",
    failed: "failed",
    canceled: "canceled",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_STATUSES: readonly JobStatus[] = Object.values(JOB_STATUS);

// canceled를 종료 상태에 포함해야 워커의 종결 가드가 취소된 잡을 덮어쓰지 않는다.
export function isTerminalJobStatus(status: JobStatus): boolean {
    return (
        status === JOB_STATUS.completed || status === JOB_STATUS.failed || status === JOB_STATUS.canceled
    );
}

// 대기 중이거나 실행 중인 잡만 취소할 수 있다.
export function isCancelableJobStatus(status: JobStatus): boolean {
    return status === JOB_STATUS.pending || status === JOB_STATUS.running;
}

export const RULE_GENERATION_FOCUS = {
    recent: "recent",
} as const;

// 프롬프트에 그대로 실리므로 입력 표면과 실행 표면이 같은 값으로 잘라야 하는 상한이다.
export const RULE_GENERATION_INTENT_MAX_LENGTH = 500;

/** 정리 제안 하나가 한 번에 낼 수 있는 제안의 상한이며 값은 계약의 잡 어휘가 소유한다. */
export const TASK_CLEANUP_MAX_SUGGESTIONS = 50;
