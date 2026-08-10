import { AGENT_BACKEND } from "@tracer-agent/llm";
import type { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";
import { readRecipeDocumentId, readSearchDrain } from "~agent-api/support/contract.js";

/** 계약이 선언한 색인 별칭이며 두 축이 이 별칭 하나를 함께 쓴다. */
export const RECIPES_INDEX_ALIAS = "recipes";

/** 배출 한 번이 읽는 아웃박스 행의 수이며 계약의 batchSize 가 정본이다. */
export const SEARCH_OUTBOX_BATCH_SIZE = readSearchDrain().batchSize;

const DOCUMENT_ID = readRecipeDocumentId();

/** 레시피 원장의 식별자를 넣는 자리이며 계약은 축의 자리표시자만 이름으로 선언한다. */
const RECIPE_ID_PLACEHOLDER = "{recipeId}";

/** 색인 문서 하나를 가리키는 식별자이며 계약의 서식에 자기 축과 레시피 식별자를 넣어 만든다. */
export function recipeDocumentId(recipeId: string): string {
    return DOCUMENT_ID.template
        .replace(DOCUMENT_ID.placeholder, AGENT_BACKEND)
        .replace(RECIPE_ID_PLACEHOLDER, recipeId);
}

/** 원장의 칸은 경로와 역할을 가진 객체 배열이며 색인에는 경로 문자열만 싣는다. */
function touchedFilePaths(touchedFiles: readonly unknown[]): string[] {
    return touchedFiles
        .map((entry) => (entry !== null && typeof entry === "object" ? (entry as { path?: unknown }).path : undefined))
        .filter((path): path is string => typeof path === "string");
}

/** recipes 색인 문서의 유일한 정의이며 계약의 wire/search.index.json 이 칸의 정본이다. */
export function buildRecipeDocument(recipe: Recipe): Record<string, unknown> {
    return {
        recipeId: recipe.id,
        backend: AGENT_BACKEND,
        userId: recipe.userId,
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        useWhen: recipe.useWhen,
        summaryMd: recipe.summaryMd,
        touchedFiles: touchedFilePaths(recipe.touchedFiles),
        status: recipe.status,
        userEdited: recipe.userEdited,
        rev: recipe.rev,
        updatedAt: recipe.updatedAt.toISOString(),
    };
}
