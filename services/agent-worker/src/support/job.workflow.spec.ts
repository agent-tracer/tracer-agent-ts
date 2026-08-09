import { readContractYaml } from "~agent-worker/support/contract.js";

export interface DeclaredActivity {
    readonly name: string;
    readonly startToCloseSeconds?: number;
    readonly scheduleToCloseSeconds?: number;
    readonly heartbeatTimeoutSeconds?: number;
    readonly maximumAttempts?: number;
}

/** 잡 워크플로 하나의 생성 활동이 갖는 벽시계 상한과 시도 수다. */
export interface JobGenerateLimits {
    readonly startToClose: string;
    readonly scheduleToClose: string;
    readonly heartbeat: string;
    readonly maximumAttempts: number;
    readonly initialInterval: string;
}

interface DeclaredWorkflows {
    readonly jobWorkflows: { readonly perKind: Readonly<Record<string, { readonly activities: readonly DeclaredActivity[] }>> };
}

/** 계약이 그 종류의 상한을 적었으면 그 값을 낸다. */
function declaredActivity(kind: string, name: string): DeclaredActivity | undefined {
    const perKind = readContractYaml<DeclaredWorkflows>("workflow/queues.yaml").jobWorkflows.perKind;
    return perKind[kind]?.activities.find((activity) => activity.name === name);
}

function seconds(value: number): string {
    return `${value} seconds`;
}

/** 계약이 적은 상한을 그대로 옮기며 계약이 그 종류를 적지 않으면 이 축이 정한 값을 쓴다. */
export function generateLimitsOf(
    declared: DeclaredActivity | undefined,
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

/** 잡 종류마다 다른 생성 활동의 상한이며 계약이 그 종류를 적은 자리는 계약이 정본이다. */
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
    titleSuggestion: generateLimitsOf(declaredActivity("titleSuggestion", "generateTitleSuggestion"), {
        startToClose: "5 minutes",
        scheduleToClose: "20 minutes",
        heartbeat: "30 seconds",
        maximumAttempts: 3,
        initialInterval: "10 seconds",
    }),
} satisfies Readonly<Record<string, JobGenerateLimits>>;

/** 잡 종류마다의 짧은 활동 상한이며 워크플로 셋이 이 한 자리를 읽는다. */
export const JOB_SHORT_LIMITS = {
    recipeScan: { prepare: "1 minute", finalize: "1 minute" },
    taskCleanup: { prepare: "2 minutes", finalize: "1 minute" },
    titleSuggestion: { prepare: "1 minute", finalize: "1 minute" },
} as const;

/** 짧은 활동은 종류를 가리지 않고 같은 시도 수를 쓴다. */
export const JOB_SHORT_MAX_ATTEMPTS = 5;
