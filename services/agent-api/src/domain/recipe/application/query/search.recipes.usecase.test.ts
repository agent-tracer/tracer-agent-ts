import { describe, expect, it } from "vitest";
import { FixedRecipeSearch } from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { RECIPE_SEARCH_LIMIT, SearchRecipesUseCase } from "./search.recipes.usecase.js";

function hits(count: number) {
    return Array.from({ length: count }, (_unused, index) => ({
        id: `recipe-${String(index + 1)}`,
        title: "제목",
        intent: "의도",
        description: "설명",
        useWhen: ["조건"],
        score: 10 - index,
    }));
}

describe("레시피를 본문 유사도로 검색한다", () => {
    it("적중을 얇은 모양으로 옮긴다", async () => {
        const search = new FixedRecipeSearch(hits(1));

        const result = await new SearchRecipesUseCase(search).execute({ userId: "local", q: "빌드" });

        expect(result.items[0]).toEqual({
            recipeId: "recipe-1",
            title: "제목",
            intent: "의도",
            description: "설명",
            useWhen: ["조건"],
            score: 10,
        });
    });

    it("다듬은 질의가 비면 색인을 부르지 않고 빈 목록을 낸다", async () => {
        const search = new FixedRecipeSearch(hits(3));

        const result = await new SearchRecipesUseCase(search).execute({ userId: "local", q: "   " });

        expect({ items: result.items, calls: search.calls }).toEqual({ items: [], calls: [] });
    });

    it("상한을 싣지 않으면 계약이 정한 기본값을 쓴다", async () => {
        const search = new FixedRecipeSearch(hits(10));

        await new SearchRecipesUseCase(search).execute({ userId: "local", q: "빌드" });

        expect(search.calls[0]?.limit).toBe(RECIPE_SEARCH_LIMIT.default);
    });

    it("상한을 넘겨 실으면 계약이 정한 최대까지만 부른다", async () => {
        const search = new FixedRecipeSearch(hits(10));

        await new SearchRecipesUseCase(search).execute({ userId: "local", q: "빌드", limit: 50 });

        expect(search.calls[0]?.limit).toBe(RECIPE_SEARCH_LIMIT.max);
    });

    it("상한을 최소보다 작게 실으면 계약이 정한 최소로 올린다", async () => {
        const search = new FixedRecipeSearch(hits(10));

        await new SearchRecipesUseCase(search).execute({ userId: "local", q: "빌드", limit: 0 });

        expect(search.calls[0]?.limit).toBe(RECIPE_SEARCH_LIMIT.min);
    });
});
