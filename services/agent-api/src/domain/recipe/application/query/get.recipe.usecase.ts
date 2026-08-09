import { Inject, Injectable } from "@nestjs/common";
import { recipeStats, type RecipeStats } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import {
    RECIPE_APPLICATION_REPOSITORY,
    RECIPE_REPOSITORY,
    type RecipeApplicationRepositoryPort,
    type RecipeRepositoryPort,
} from "~agent-api/domain/recipe/port/recipe.repository.port.js";
import {
    mapRecipe,
    mapRecipeApplication,
    type RecipeApplicationDto,
    type RecipeDto,
} from "~agent-api/domain/recipe/application/recipe.support.js";

export interface RecipeDetail {
    readonly recipe: RecipeDto;
    readonly stats: RecipeStats;
    readonly applications: readonly RecipeApplicationDto[];
}

/** 레시피 하나를 전문과 적용 이력까지 낸다. */
@Injectable()
export class GetRecipeUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_APPLICATION_REPOSITORY) private readonly applications: RecipeApplicationRepositoryPort,
    ) {}

    async execute(userId: string, id: string): Promise<RecipeDetail | null> {
        const recipe = await this.recipes.findById(id);
        // 남의 레시피는 존재 자체를 알리지 않는다.
        if (recipe === null || recipe.userId !== userId) return null;
        const applications = await this.applications.findByRecipe(id);
        return {
            recipe: mapRecipe(recipe),
            stats: recipeStats(applications),
            applications: applications.map(mapRecipeApplication),
        };
    }
}
