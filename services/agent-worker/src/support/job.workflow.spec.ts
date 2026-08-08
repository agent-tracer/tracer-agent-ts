/** 잡 워크플로 하나의 생성 활동이 갖는 벽시계 상한과 시도 수다. */
export interface JobGenerateLimits {
    readonly startToClose: string;
    readonly scheduleToClose: string;
    readonly heartbeat: string;
    readonly maximumAttempts: number;
    readonly initialInterval: string;
}

/** 잡 종류마다 다른 생성 활동의 상한이며 계약이 titleSuggestion 외의 상한을 갖지 않으므로 워크플로와 실행 구조 문서가 이 한 자리를 읽는다. */
export const JOB_GENERATE_LIMITS = {
    recipeScan: {
        startToClose: "15 minutes",
        scheduleToClose: "1 hour",
        heartbeat: "30 seconds",
        maximumAttempts: 3,
        initialInterval: "10 seconds",
    },
    taskCleanup: {
        startToClose: "10 minutes",
        scheduleToClose: "30 minutes",
        heartbeat: "30 seconds",
        maximumAttempts: 3,
        initialInterval: "10 seconds",
    },
    titleSuggestion: {
        startToClose: "5 minutes",
        scheduleToClose: "20 minutes",
        heartbeat: "30 seconds",
        maximumAttempts: 3,
        initialInterval: "10 seconds",
    },
} as const satisfies Readonly<Record<string, JobGenerateLimits>>;

/** 잡 종류마다의 짧은 활동 상한이며 워크플로 셋이 이 한 자리를 읽는다. */
export const JOB_SHORT_LIMITS = {
    recipeScan: { prepare: "1 minute", finalize: "1 minute" },
    taskCleanup: { prepare: "2 minutes", finalize: "1 minute" },
    titleSuggestion: { prepare: "1 minute", finalize: "1 minute" },
} as const;

/** 짧은 활동은 종류를 가리지 않고 같은 시도 수를 쓴다. */
export const JOB_SHORT_MAX_ATTEMPTS = 5;
