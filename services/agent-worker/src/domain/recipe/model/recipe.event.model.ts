/** 사용자가 보낸 메시지 이벤트의 종류이며 값은 수집 어휘가 소유한다. */
export const USER_MESSAGE_EVENT_KIND = "agent_tracer.user.message";

/** 에이전트가 소비하는 태스크 이벤트 표현이며 이 슬라이스가 단독으로 갖는다. */
export interface RecipeSlimEvent {
    readonly id: string;
    readonly seq: string;
    /** 사용자 작업 하나의 경계이며 후보를 나누는 축이다. */
    readonly turnId?: string;
    readonly kind: string;
    readonly title: string;
    readonly body?: string;
    readonly toolName?: string;
    readonly filePaths: readonly string[];
    readonly occurredAt: string;
}

/** 검색은 태스크를 가로질러 돌아오므로 검색 결과 이벤트는 자기 taskId를 함께 싣는다. */
export interface RecipeSearchEvent extends RecipeSlimEvent {
    readonly taskId: string;
}

/** 태스크 이벤트 조회 한 페이지다. */
export interface RecipeEventPage {
    readonly events: readonly RecipeSlimEvent[];
    readonly truncated: boolean;
    readonly nextCursor?: string;
    readonly total: number;
}

export function isUserMessageEvent(event: RecipeSlimEvent): boolean {
    return event.kind === USER_MESSAGE_EVENT_KIND;
}

/** 페이지 한 장을 잘라 다음 커서를 붙인다. */
export function toRecipeEventPage(
    events: readonly RecipeSlimEvent[],
    limit: number,
    total: number,
): RecipeEventPage {
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
