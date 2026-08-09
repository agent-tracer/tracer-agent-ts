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

/** 후보를 채택하고 고쳐 쓴 부모가 있으면 그 부모를 대체됨으로 함께 옮긴다. */
@Injectable()
export class AcceptRecipeUseCase {
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
        const parent = await this.readOwnedParent(tx, userId, recipe.parentRecipeId);
        recipe.accept(now);
        await tx.recipes.upsert(recipe);
        await enqueueRecipeIndex(tx, this.ids.next(), userId, recipe.id, now);
        if (parent === null) return recipe;
        parent.supersede(now);
        await tx.recipes.upsert(parent);
        await enqueueRecipeIndex(tx, this.ids.next(), userId, parent.id, now);
        return recipe;
    }

    /** 부모가 남의 것이면 거절하지 않고 부모가 없는 것으로 보아 채택만 한다. */
    private async readOwnedParent(tx: RecipeTx, userId: string, parentId: string | null): Promise<Recipe | null> {
        if (parentId === null) return null;
        const parent = await tx.recipes.findById(parentId);
        return parent !== null && parent.userId === userId ? parent : null;
    }
}
