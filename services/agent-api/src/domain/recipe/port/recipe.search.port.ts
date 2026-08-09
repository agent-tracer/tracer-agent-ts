export const RECIPE_SEARCH = Symbol("RecipeSearch");

/** 색인이 낸 레시피 한 건이며 점수는 적중 사이의 순서에만 뜻이 있다. */
export interface RecipeSearchHit {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly useWhen: readonly string[];
    readonly score: number;
}

/** 레시피 색인의 질의를 제공하는 포트이며 쓰기는 아웃박스 배출기가 맡는다. */
export interface RecipeSearchPort {
    search(userId: string, q: string, limit: number): Promise<readonly RecipeSearchHit[]>;
}
