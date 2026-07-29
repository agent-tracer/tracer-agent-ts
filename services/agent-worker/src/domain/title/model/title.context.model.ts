/** 컨텍스트가 싣는 최근 턴 창의 크기이며 최초 턴이 창 밖이면 하나가 더 붙는다. */
export const RECENT_TURN_LIMIT = 20;

/** 요약이 보는 태스크의 순수 표현이다. */
export interface TitleTaskSnapshot {
    readonly title: string;
    readonly status: string;
    readonly workspacePath?: string;
}

/** 한 번의 요청과 그에 대한 응답이다. */
export interface TitleTurn {
    readonly turnIndex: number;
    readonly askedText: string;
    readonly assistantText: string | null;
}

/** 프롬프트가 보는 대화 턴 컨텍스트다. */
export interface TitleContext {
    readonly title: string;
    readonly status: string;
    readonly workspacePath?: string;
    readonly totalEventCount: number;
    readonly totalTurnCount: number;
    readonly truncated: boolean;
    readonly turns: readonly TitleTurn[];
}

/** 태스크의 턴을 최초 요청과 최근 창으로 좁혀 컨텍스트를 만든다. */
export function buildTitleContext(
    task: TitleTaskSnapshot,
    allTurns: readonly TitleTurn[],
    totalEventCount: number,
): TitleContext {
    const ascending = [...allTurns].sort((left, right) => left.turnIndex - right.turnIndex);
    const recent = ascending.slice(-RECENT_TURN_LIMIT);
    const first = ascending[0];
    const included = first !== undefined && !recent.includes(first) ? [first, ...recent] : recent;

    return {
        title: task.title,
        status: task.status,
        ...(task.workspacePath !== undefined ? { workspacePath: task.workspacePath } : {}),
        totalEventCount,
        totalTurnCount: ascending.length,
        truncated: ascending.length > included.length,
        turns: included,
    };
}
