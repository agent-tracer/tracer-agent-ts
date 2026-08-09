export const RECIPE_TASK_READER = Symbol("RecipeTaskReader");

/** 추적 원장의 태스크 한 건에서 제목 표를 만드는 데 필요한 칸만 담는다. */
export interface RecipeTaskTitle {
    readonly id: string;
    readonly title: string;
}

/** 인용된 태스크의 제목을 한 번에 읽는 포트이며 닿지 않는 식별자는 결과에서 빠진다. */
export interface RecipeTaskReaderPort {
    findTitlesByIds(userId: string, ids: readonly string[]): Promise<readonly RecipeTaskTitle[]>;
}
