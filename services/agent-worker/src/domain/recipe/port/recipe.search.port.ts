import type { RecipeSearchEvent } from "~agent-worker/domain/recipe/model/recipe.event.model.js";

/** 이벤트를 본문 유사도로 찾는 한 번의 질의다. */
export interface RecipeEventSearchQuery {
    readonly q: string;
    readonly taskId?: string;
    readonly kind?: string;
    readonly toolName?: string;
    /** 모델에게 돌려줄 적중 수이며 구현은 이보다 한 건 더 읽어 잘림을 가린다. */
    readonly limit: number;
    readonly offset: number;
}

export interface RecipeEventSearchPage {
    readonly events: readonly RecipeSearchEvent[];
    readonly truncated: boolean;
    readonly total: number;
}

/** 검색이 낸 태스크 한 건이며 모델이 다음 조회를 고를 만큼만 담는다. */
export interface RecipeSlimTask {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind?: string;
    readonly updatedAt?: string;
}

/** 검색이 낸 레시피 한 건이며 rev는 고쳐 쓸 대상을 지목할 때의 관측 판이다. */
export interface RecipeSlimRecipe {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly status: string;
    readonly userEdited: boolean;
    readonly rev?: number;
    readonly updatedAt?: string;
}

/** 레시피 도구가 추적 서비스의 검색 창구에 요구하는 표면이다. */
export interface RecipeSearchPort {
    searchEvents(userId: string, query: RecipeEventSearchQuery): Promise<RecipeEventSearchPage>;
    searchTasks(userId: string, q: string, limit: number): Promise<readonly RecipeSlimTask[]>;
    searchRecipes(userId: string, q: string, limit: number): Promise<readonly RecipeSlimRecipe[]>;
}
