import type { RecipeStatus } from "~agent-api/domain/recipe/model/recipe.const.js";
import type { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";
import type { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";

export const RECIPE_REPOSITORY = Symbol("RecipeRepository");
export const RECIPE_APPLICATION_REPOSITORY = Symbol("RecipeApplicationRepository");

/** 레시피 원장의 조회와 저장을 제공하는 포트이며 조회는 지운 행을 내지 않는다. */
export interface RecipeRepositoryPort {
    findById(id: string): Promise<Recipe | null>;
    findByStatus(userId: string, status: RecipeStatus): Promise<Recipe[]>;
    upsert(recipe: Recipe): Promise<void>;
}

/** 레시피 적용 이력의 조회와 저장을 제공하는 포트다. */
export interface RecipeApplicationRepositoryPort {
    findByRecipe(recipeId: string): Promise<RecipeApplication[]>;
    findByTask(taskId: string): Promise<RecipeApplication[]>;
    upsert(application: RecipeApplication): Promise<void>;
}
