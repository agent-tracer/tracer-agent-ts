import { AGENT_BACKEND } from "@tracer-agent/llm";
import type { OpenSearchClient } from "~agent-api/config/opensearch.client.js";
import { RECIPES_INDEX_ALIAS } from "~agent-api/domain/recipe/model/recipe.document.js";
import { RECIPE_STATUS } from "~agent-api/domain/recipe/model/recipe.const.js";
import type { RecipeSearchHit, RecipeSearchPort } from "~agent-api/domain/recipe/port/recipe.search.port.js";

/** 얇은 코퍼스에서 실측해 정한 값이며 계약의 wire/search.index.json 이 같은 수를 갖는다. */
export const MINIMUM_SHOULD_MATCH = "30%";

/** 가장 높은 점수의 이 비율에 못 미치는 적중을 버리며 계약이 같은 수를 갖는다. */
export const RELATIVE_SCORE_CUTOFF_RATIO = 0.4;

/** 계약이 선언한 뒤질 칸이며 색인 문서가 갖지 않는 칸을 여기에 적으면 언제나 비어서 온다. */
export const MATCH_FIELDS = ["title", "intent", "description", "useWhen", "summaryMd"];

interface SearchHit {
    readonly _id: string;
    readonly _score?: number | null;
    readonly _source?: Record<string, unknown>;
}

interface SearchResponseBody {
    readonly hits: { readonly hits: readonly SearchHit[] };
}

/** 레시피 색인의 질의를 구현하며 채택된 자기 레시피만 대상으로 한다. */
export class OpenSearchRecipeSearchAdapter implements RecipeSearchPort {
    constructor(private readonly client: OpenSearchClient) {}

    async search(userId: string, q: string, limit: number): Promise<readonly RecipeSearchHit[]> {
        const body = (await this.client.request("POST", `/${RECIPES_INDEX_ALIAS}/_search`, {
            size: limit,
            query: {
                bool: {
                    must: [
                        {
                            multi_match: {
                                query: q,
                                fields: MATCH_FIELDS,
                                minimum_should_match: MINIMUM_SHOULD_MATCH,
                            },
                        },
                    ],
                    // 축을 거르지 않으면 두 축이 색인한 같은 레시피가 한 질의에 두 번 적중한다.
                    filter: [
                        { term: { userId } },
                        { term: { backend: AGENT_BACKEND } },
                        { term: { status: RECIPE_STATUS.active } },
                    ],
                },
            },
        })) as SearchResponseBody;
        return applyRelativeCutoff(body.hits.hits).map(toHit);
    }
}

/** 상한을 채우려고 관련 없는 것을 함께 내지 않는다. */
function applyRelativeCutoff(hits: readonly SearchHit[]): readonly SearchHit[] {
    const topScore = hits[0]?._score ?? 0;
    if (topScore <= 0) return hits;
    const threshold = topScore * RELATIVE_SCORE_CUTOFF_RATIO;
    return hits.filter((hit) => (hit._score ?? 0) >= threshold);
}

/** 문서 식별자에는 축이 붙어 있으므로 레시피의 식별자는 문서의 칸에서 읽는다. */
function toHit(hit: SearchHit): RecipeSearchHit {
    const source = hit._source ?? {};
    return {
        id: readString(source["recipeId"]),
        title: readString(source["title"]),
        intent: readString(source["intent"]),
        description: readString(source["description"]),
        useWhen: readStrings(source["useWhen"]),
        score: hit._score ?? 0,
    };
}

function readString(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function readStrings(value: unknown): readonly string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}
