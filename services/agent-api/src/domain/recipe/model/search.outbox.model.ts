import { SEARCH_OUTBOX_TARGET_RECIPE } from "~agent-api/domain/recipe/model/recipe.const.js";

/** 색인 반영 요청 한 줄이며 도메인 쓰기와 같은 커밋에 들어가 배출기가 뒤에서 반영한다. */
export class SearchOutboxRow {
    id!: string;

    userId!: string;

    target!: string;

    targetId!: string;

    attempts!: number;

    lastError!: string | null;

    createdAt!: Date;

    static enqueueRecipe(id: string, userId: string, recipeId: string, now: Date): SearchOutboxRow {
        const row = new SearchOutboxRow();
        row.id = id;
        row.userId = userId;
        row.target = SEARCH_OUTBOX_TARGET_RECIPE;
        row.targetId = recipeId;
        row.attempts = 0;
        row.lastError = null;
        row.createdAt = now;
        return row;
    }
}
