import type { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";
import type { RecipeRepositoryPort } from "~agent-api/domain/recipe/port/recipe.repository.port.js";

export const RECIPE_TRANSACTION = Symbol("RecipeTransaction");

/** 같은 커밋에 색인 반영 요청을 남기는 포트다. */
export interface SearchOutboxWriterPort {
    enqueue(row: SearchOutboxRow): Promise<void>;
}

/** 한 커밋 안에서만 유효한 레시피 저장소 묶음이다. */
export interface RecipeTx {
    readonly recipes: RecipeRepositoryPort;
    readonly searchOutbox: SearchOutboxWriterPort;
}

/** 레시피 쓰기와 색인 적재를 한 커밋으로 묶어 실행하는 포트다. */
export interface RecipeTransactionPort {
    run<T>(work: (tx: RecipeTx) => Promise<T>): Promise<T>;
}
