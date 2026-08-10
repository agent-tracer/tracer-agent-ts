import { RECIPES_INDEX_ALIAS } from "~agent-api/domain/recipe/model/recipe.document.js";

/** 색인 하나를 세우는 데 필요한 전부이며 별칭과 물리 이름을 함께 갖는다. */
export interface SearchIndexDefinition {
    readonly alias: string;
    readonly index: string;
    readonly settings: Record<string, unknown>;
    readonly mappings: Record<string, unknown>;
}

/** 별칭이 가리키는 물리 색인이며 매핑을 바꿀 때는 이 이름의 판을 올린다. */
export const RECIPES_PHYSICAL_INDEX = "recipes-v2";

/** 표준 분석기는 한글 음절 뭉치를 토큰 하나로 색인하므로 두 글자 ngram 으로 색인하고 질의한다. */
const SUBSTRING_ANALYSIS = {
    analyzer: {
        substring: { type: "custom", tokenizer: "substring_bigram", filter: ["lowercase"] },
    },
    tokenizer: {
        substring_bigram: { type: "ngram", min_gram: 2, max_gram: 2, token_chars: ["letter", "digit"] },
    },
};

const TEXT = { type: "text", analyzer: "substring" };
const KEYWORD = { type: "keyword" };

/** 레시피 색인의 정의이며 계약의 wire/search.index.json 의 indices.recipes 가 정본이다. */
export const RECIPES_INDEX_DEFINITION: SearchIndexDefinition = {
    alias: RECIPES_INDEX_ALIAS,
    index: RECIPES_PHYSICAL_INDEX,
    settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: SUBSTRING_ANALYSIS,
    },
    mappings: {
        properties: {
            recipeId: KEYWORD,
            backend: KEYWORD,
            userId: KEYWORD,
            title: TEXT,
            intent: TEXT,
            description: TEXT,
            useWhen: TEXT,
            summaryMd: TEXT,
            touchedFiles: KEYWORD,
            status: KEYWORD,
            userEdited: { type: "boolean" },
            rev: { type: "integer" },
            updatedAt: { type: "date" },
        },
    },
};
