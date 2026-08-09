import {
    DECLARED_JOB_ACTIVITIES,
    type DeclaredJobActivity,
} from "~agent-worker/support/job.workflow.declaration.js";

/** 잡 워크플로 하나의 생성 활동이 갖는 벽시계 상한과 시도 수다. */
export interface JobGenerateLimits {
    readonly startToClose: string;
    readonly scheduleToClose: string;
    readonly heartbeat: string;
    readonly maximumAttempts: number;
    readonly initialInterval: string;
}

/** 계약이 그 종류의 상한을 적었으면 그 값을 낸다. */
function declaredActivity(kind: string, name: string): DeclaredJobActivity | undefined {
    return DECLARED_JOB_ACTIVITIES[kind]?.find((activity) => activity.name === name);
}

function seconds(value: number): string {
    return `${value} seconds`;
}

/** 계약이 적은 상한을 그대로 옮기며 계약이 그 종류를 적지 않으면 이 축이 정한 값을 쓴다. */
export function generateLimitsOf(
    declared: DeclaredJobActivity | undefined,
    own: JobGenerateLimits,
): JobGenerateLimits {
    if (declared?.startToCloseSeconds === undefined) return own;
    return {
        startToClose: seconds(declared.startToCloseSeconds),
        scheduleToClose: declared.scheduleToCloseSeconds === undefined
            ? own.scheduleToClose
            : seconds(declared.scheduleToCloseSeconds),
        heartbeat: declared.heartbeatTimeoutSeconds === undefined
            ? own.heartbeat
            : seconds(declared.heartbeatTimeoutSeconds),
        maximumAttempts: declared.maximumAttempts ?? own.maximumAttempts,
        initialInterval: own.initialInterval,
    };
}

/** 잡 종류마다 생성 활동의 이름이 다르므로 계약에서 그 종류의 상한을 찾는 열쇠다. */
export const JOB_GENERATE_ACTIVITY = {
    recipeScan: "generateRecipeCandidates",
    taskCleanup: "generateTaskCleanupSuggestions",
    titleSuggestion: "generateTitleSuggestion",
} as const;

/** 계약이 그 종류를 적지 않았을 때만 쓰는 값이며 계약이 셋을 모두 적는 동안 이 자리는 실행되지 않는다. */
const JOB_GENERATE_FALLBACK = {
    startToClose: "15 minutes",
    scheduleToClose: "1 hour",
    heartbeat: "30 seconds",
    maximumAttempts: 3,
    initialInterval: "10 seconds",
} as const satisfies JobGenerateLimits;

/** 잡 종류마다 다른 생성 활동의 상한이며 계약이 정본이다. */
export const JOB_GENERATE_LIMITS = {
    recipeScan: generateLimitsOf(
        declaredActivity("recipeScan", JOB_GENERATE_ACTIVITY.recipeScan),
        JOB_GENERATE_FALLBACK,
    ),
    taskCleanup: generateLimitsOf(
        declaredActivity("taskCleanup", JOB_GENERATE_ACTIVITY.taskCleanup),
        JOB_GENERATE_FALLBACK,
    ),
    titleSuggestion: generateLimitsOf(
        declaredActivity("titleSuggestion", JOB_GENERATE_ACTIVITY.titleSuggestion),
        JOB_GENERATE_FALLBACK,
    ),
} satisfies Readonly<Record<string, JobGenerateLimits>>;

/** 잡 종류마다의 짧은 활동 상한이며 워크플로 셋이 이 한 자리를 읽는다. */
export const JOB_SHORT_LIMITS = {
    recipeScan: { prepare: "1 minute", finalize: "1 minute" },
    taskCleanup: { prepare: "2 minutes", finalize: "1 minute" },
    titleSuggestion: { prepare: "1 minute", finalize: "1 minute" },
} as const;

/** 짧은 활동은 종류를 가리지 않고 같은 시도 수를 쓴다. */
export const JOB_SHORT_MAX_ATTEMPTS = 5;
