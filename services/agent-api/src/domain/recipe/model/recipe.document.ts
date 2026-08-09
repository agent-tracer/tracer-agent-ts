import type { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";

/** 계약이 선언한 색인 별칭이며 문서 식별자는 레시피 원장의 식별자를 그대로 쓴다. */
export const RECIPES_INDEX_ALIAS = "recipes";

/** 배출 한 번이 읽는 아웃박스 행의 수이며 계약의 batchSize 와 같다. */
export const SEARCH_OUTBOX_BATCH_SIZE = 100;

/** 원장의 칸은 경로와 역할을 가진 객체 배열이며 색인에는 경로 문자열만 싣는다. */
function touchedFilePaths(touchedFiles: readonly unknown[]): string[] {
    return touchedFiles
        .map((entry) => (entry !== null && typeof entry === "object" ? (entry as { path?: unknown }).path : undefined))
        .filter((path): path is string => typeof path === "string");
}

/** recipes 색인 문서의 유일한 정의이며 계약의 wire/search.index.json 이 칸의 정본이다. */
export function buildRecipeDocument(recipe: Recipe): Record<string, unknown> {
    return {
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
