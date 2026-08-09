// contract/workflow/queues.yaml의 jobWorkflows.perKind에서 만든 파일이라 손으로 고치지 않는다.

/** 계약이 활동 하나에 적은 벽시계 상한과 시도 수다. */
export interface DeclaredJobActivity {
    readonly name: string;
    readonly startToCloseSeconds?: number;
    readonly scheduleToCloseSeconds?: number;
    readonly heartbeatTimeoutSeconds?: number;
    readonly maximumAttempts?: number;
}

/** 워크플로 번들은 결정적 샌드박스라 파일을 읽지 못하므로 계약의 값을 빌드 시점에 상수로 만든다. */
export const DECLARED_JOB_ACTIVITIES: Readonly<Record<string, readonly DeclaredJobActivity[]>> = {
    titleSuggestion: [
        { name: "prepareTitleSuggestion", startToCloseSeconds: 60, maximumAttempts: 5 },
        { name: "generateTitleSuggestion", startToCloseSeconds: 300, scheduleToCloseSeconds: 1200, heartbeatTimeoutSeconds: 30, maximumAttempts: 3 },
        { name: "finalizeTitleSuggestion", startToCloseSeconds: 60, maximumAttempts: 5 },
        { name: "markTitleJobFailed", startToCloseSeconds: 60, maximumAttempts: 5 },
    ],
    recipeScan: [
        { name: "prepareRecipeScan", startToCloseSeconds: 60, maximumAttempts: 5 },
        { name: "generateRecipeCandidates", startToCloseSeconds: 900, scheduleToCloseSeconds: 3600, heartbeatTimeoutSeconds: 30, maximumAttempts: 3 },
        { name: "finalizeRecipeScan", startToCloseSeconds: 60, maximumAttempts: 5 },
        { name: "markRecipeJobFailed", startToCloseSeconds: 60, maximumAttempts: 5 },
    ],
    taskCleanup: [
        { name: "prepareTaskCleanup", startToCloseSeconds: 120, maximumAttempts: 5 },
        { name: "generateTaskCleanupSuggestions", startToCloseSeconds: 600, scheduleToCloseSeconds: 1800, heartbeatTimeoutSeconds: 30, maximumAttempts: 3 },
        { name: "finalizeTaskCleanup", startToCloseSeconds: 60, maximumAttempts: 5 },
        { name: "markCleanupJobFailed", startToCloseSeconds: 60, maximumAttempts: 5 },
    ],
};
