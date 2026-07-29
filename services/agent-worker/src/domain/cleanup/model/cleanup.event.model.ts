/** 에이전트가 소비하는 태스크 이벤트 표현이며 cleanup 슬라이스가 단독으로 갖는다. */
export interface CleanupSlimEvent {
    readonly id: string;
    readonly seq: string;
    readonly kind: string;
    readonly title: string;
    readonly body?: string;
    readonly toolName?: string;
    readonly filePaths: readonly string[];
    readonly occurredAt: string;
}

/** 태스크 이벤트 조회 한 페이지다. */
export interface CleanupEventPage {
    readonly events: readonly CleanupSlimEvent[];
    readonly truncated: boolean;
    readonly nextCursor?: string;
    readonly total: number;
}

/** 페이지 한 장을 잘라 다음 커서를 붙인다. */
export function toCleanupEventPage(
    events: readonly CleanupSlimEvent[],
    limit: number,
    total: number,
): CleanupEventPage {
    const truncated = events.length > limit;
    const windowed = truncated ? events.slice(0, limit) : events;
    const last = windowed[windowed.length - 1];
    return {
        events: windowed,
        truncated,
        ...(truncated && last !== undefined ? { nextCursor: last.seq } : {}),
        total,
    };
}
