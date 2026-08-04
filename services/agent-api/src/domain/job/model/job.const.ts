/** 사용자 설정에서 모델 자격을 찾는 키다. */
export const JOB_API_KEY_SETTING = "anthropic.api_key";

/** 사용자가 접수할 수 있는 잡의 종류이며 값은 계약의 잡 어휘가 소유한다. */
export const JOB_KIND = {
    titleSuggestion: "title.suggestion",
    recipeScan: "recipe.scan",
    taskCleanup: "task.cleanup",
    ruleGeneration: "rule.generation",
} as const;

export type JobKind = (typeof JOB_KIND)[keyof typeof JOB_KIND];

export const JOB_KINDS: readonly JobKind[] = Object.values(JOB_KIND);

/** 잡 하나를 실제로 실행하는 주체이며 워크플로가 실행하는 것과 플러그인이 궤적을 넘기는 것을 구분한다. */
export const JOB_EXECUTOR = {
    [JOB_KIND.titleSuggestion]: "temporal",
    [JOB_KIND.recipeScan]: "temporal",
    [JOB_KIND.taskCleanup]: "temporal",
    [JOB_KIND.ruleGeneration]: "local",
} as const satisfies Record<JobKind, "temporal" | "local">;

export type JobExecutor = (typeof JOB_EXECUTOR)[JobKind];

/** 워크플로가 실행하는 잡 종류이며 실행 봉투는 이 셋에만 발급된다. */
export const WORKFLOW_JOB_KINDS = [
    JOB_KIND.titleSuggestion,
    JOB_KIND.recipeScan,
    JOB_KIND.taskCleanup,
] as const;

export type WorkflowJobKind = (typeof WORKFLOW_JOB_KINDS)[number];

/** 잡 종류가 모델과 한도를 가져오는 카탈로그 기능의 이름이다. */
export const JOB_FEATURE_BY_KIND = {
    [JOB_KIND.titleSuggestion]: "title-suggestion",
    [JOB_KIND.recipeScan]: "recipe-scan",
    [JOB_KIND.taskCleanup]: "task-cleanup",
} as const satisfies Record<WorkflowJobKind, string>;

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
