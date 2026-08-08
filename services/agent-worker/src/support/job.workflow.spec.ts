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
