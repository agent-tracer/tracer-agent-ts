import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";
import { RECIPE_CLOCK, type ClockPort } from "~agent-api/domain/recipe/port/clock.port.js";
import {
    RECIPE_ID_GENERATOR,
    type RecipeIdGeneratorPort,
} from "~agent-api/domain/recipe/port/recipe.id.generator.port.js";
import {
    RECIPE_TRANSACTION,
    type RecipeTransactionPort,
    type RecipeTx,
} from "~agent-api/domain/recipe/port/recipe.transaction.port.js";
import { enqueueRecipeIndex, mapRecipe, type RecipeDto } from "~agent-api/domain/recipe/application/recipe.support.js";

/** 쓰이던 레시피를 폐기해 검색이 더는 그 절차를 모델에게 내지 않게 한다. */
@Injectable()
export class RetireRecipeUseCase {
    constructor(
        @Inject(RECIPE_TRANSACTION) private readonly tx: RecipeTransactionPort,
        @Inject(RECIPE_CLOCK) private readonly clock: ClockPort,
        @Inject(RECIPE_ID_GENERATOR) private readonly ids: RecipeIdGeneratorPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly recipe: RecipeDto }> {
        const now = this.clock.now();
        const recipe = await this.tx.run((tx) => this.applyInTransaction(tx, userId, id, now));
        return { recipe: mapRecipe(recipe) };
    }

    private async applyInTransaction(tx: RecipeTx, userId: string, id: string, now: Date): Promise<Recipe> {
        const recipe = await tx.recipes.findById(id);
        // 남의 레시피는 존재 자체를 알리지 않는다.
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");
        recipe.retire(now);
        await tx.recipes.upsert(recipe);
        await enqueueRecipeIndex(tx, this.ids.next(), userId, recipe.id, now);
        return recipe;
    }
}
