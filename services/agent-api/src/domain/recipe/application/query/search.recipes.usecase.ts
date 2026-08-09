import { Inject, Injectable } from "@nestjs/common";
import {
    RECIPE_SEARCH,
    type RecipeSearchHit,
    type RecipeSearchPort,
} from "~agent-api/domain/recipe/port/recipe.search.port.js";

/** 고르는 데 필요한 칸만 실은 얇은 적중이며 단계와 지적은 조회 창구로 미룬다. */
export interface RecipeSearchResultItem {
    readonly recipeId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly useWhen: readonly string[];
    readonly score: number;
}

export interface SearchRecipesInput {
    readonly userId: string;
    readonly q: string;
    readonly limit?: number | undefined;
}

/** 적중 수의 기본값과 상한이며 계약의 검색 창구가 같은 수를 선언한다. */
export const RECIPE_SEARCH_LIMIT = { default: 3, min: 1, max: 10 } as const;

/** 레시피를 본문 유사도로 찾아 모델이 고르는 데 필요한 칸만 낸다. */
@Injectable()
export class SearchRecipesUseCase {
    constructor(@Inject(RECIPE_SEARCH) private readonly search: RecipeSearchPort) {}

    async execute(input: SearchRecipesInput): Promise<{ readonly items: readonly RecipeSearchResultItem[] }> {
        const q = input.q.trim();
        if (q.length === 0) return { items: [] };
        const hits = await this.search.search(input.userId, q, clampLimit(input.limit));
        return { items: hits.map(toItem) };
    }
}

function clampLimit(limit: number | undefined): number {
    if (limit === undefined) return RECIPE_SEARCH_LIMIT.default;
    return Math.min(Math.max(Math.trunc(limit), RECIPE_SEARCH_LIMIT.min), RECIPE_SEARCH_LIMIT.max);
}

function toItem(hit: RecipeSearchHit): RecipeSearchResultItem {
    return {
        recipeId: hit.id,
        title: hit.title,
        intent: hit.intent,
        description: hit.description,
        useWhen: hit.useWhen,
        score: hit.score,
    };
}
