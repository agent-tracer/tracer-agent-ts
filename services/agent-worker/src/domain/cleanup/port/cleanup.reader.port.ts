export interface CleanupTask {
    readonly id: string;
}

export interface CleanupEvent {
    readonly id: string;
    readonly seq: string;
    readonly kind: string;
    readonly title: string;
    readonly body: string | null;
    readonly toolName: string | null;
    readonly filePaths: readonly string[];
    readonly occurredAt: Date;
}

/** cleanup 도구가 후보 태스크의 존재를 확인하는 창구다. */
export interface CleanupTaskReaderPort {
    findById(userId: string, taskId: string): Promise<CleanupTask | null>;
}

/** cleanup 도구가 태스크 이벤트를 읽는 창구다. */
export interface CleanupEventReaderPort {
    findTimeline(
        userId: string,
        taskId: string,
        cursor: { readonly seq: string } | undefined,
        limit: number,
    ): Promise<readonly CleanupEvent[]>;
    findTimelineWindow(
        userId: string,
        taskId: string,
        cursor: string | undefined,
        limit: number,
    ): Promise<readonly CleanupEvent[]>;
    countByTask(userId: string, taskId: string): Promise<number>;
}
