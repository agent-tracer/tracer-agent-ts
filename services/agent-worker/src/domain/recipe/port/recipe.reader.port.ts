export interface RecipeTask {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind: string;
    readonly workspacePath: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface RecipeEvent {
    readonly id: string;
    readonly seq: string;
    readonly turnId: string | null;
    readonly kind: string;
    readonly title: string;
    readonly body: string | null;
    readonly toolName: string | null;
    readonly filePaths: readonly string[];
    readonly metadata: Record<string, unknown>;
    readonly occurredAt: Date;
}

export type RecipeRuleExpectation =
    | { readonly kind: "command"; readonly commandMatches: readonly string[] }
    | { readonly kind: "pattern"; readonly pattern: string; readonly tool?: string }
    | { readonly kind: "action"; readonly tool: string };

export interface RecipeRule {
    readonly id: string;
    readonly name: string;
    readonly expectation: RecipeRuleExpectation;
    readonly taskId: string;
    readonly anchorEventId: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale: string | null;
    readonly signature: string;
    readonly createdAt: Date;
}

/** 레시피 도구가 태스크를 읽는 창구다. */
export interface RecipeTaskReaderPort {
    findById(userId: string, taskId: string): Promise<RecipeTask | null>;
}

/** 레시피 도구가 태스크 이벤트를 읽는 창구다. */
export interface RecipeEventReaderPort {
    findTimeline(
        userId: string,
        taskId: string,
        cursor: { readonly seq: string } | undefined,
        limit: number,
    ): Promise<readonly RecipeEvent[]>;
    findTimelineWindow(
        userId: string,
        taskId: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly RecipeEvent[]>;
    countByTask(userId: string, taskId: string): Promise<number>;
}

/** 레시피 도구가 적용 가능한 규칙을 읽는 창구다. */
export interface RecipeRuleReaderPort {
    findApplicable(userId: string, taskId: string): Promise<readonly RecipeRule[]>;
}
