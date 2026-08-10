import { AGENT_BACKEND } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { OpenSearchClient } from "~agent-api/config/opensearch.client.js";
import { recipeDocumentId } from "~agent-api/domain/recipe/model/recipe.document.js";
import { OpenSearchRecipeSearchAdapter } from "./opensearch.recipe.search.adapter.js";

/** 적중 한 벌을 내는 색인의 대역이며 점수 계산과 매칭은 실물의 몫이라 흉내 내지 않는다. */
function searchReturning(hits: readonly unknown[]): OpenSearchRecipeSearchAdapter {
    const client = new OpenSearchClient("http://index", () =>
        Promise.resolve(new Response(JSON.stringify({ hits: { hits } }))),
    );
    return new OpenSearchRecipeSearchAdapter(client);
}

describe("색인의 적중을 레시피로 읽는다", () => {
    it("레시피 식별자를 문서 식별자가 아니라 문서의 칸에서 읽는다", async () => {
        const target = searchReturning([
            {
                _id: recipeDocumentId("recipe-1"),
                _score: 1,
                _source: { recipeId: "recipe-1", backend: AGENT_BACKEND, title: "제목" },
            },
        ]);

        const hits = await target.search("local", "제목", 3);

        expect(hits.map((hit) => hit.id)).toEqual(["recipe-1"]);
    });

    it("문서에 레시피 식별자가 없으면 빈 식별자를 낸다", async () => {
        const target = searchReturning([{ _id: recipeDocumentId("recipe-1"), _score: 1, _source: {} }]);

        const hits = await target.search("local", "제목", 3);

        expect(hits.map((hit) => hit.id)).toEqual([""]);
    });
});
