export const RECIPE_ID_GENERATOR = Symbol("RecipeIdGenerator");

/** 응용 계층이 새 식별자를 받는 유일한 통로다. */
export interface RecipeIdGeneratorPort {
    next(): string;
}
