import { Inject, Injectable, NotFoundException } from "@nestjs/common";
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
import { enqueueRecipeIndex } from "~agent-api/domain/recipe/application/recipe.support.js";

export interface DeleteRecipeResult {
    readonly deleted: true;
    readonly id: string;
}

/** 보류하거나 폐기한 레시피를 지운 것으로 표시하고 검색 문서도 함께 사라지게 한다. */
@Injectable()
export class DeleteRecipeUseCase {
    constructor(
        @Inject(RECIPE_TRANSACTION) private readonly tx: RecipeTransactionPort,
        @Inject(RECIPE_CLOCK) private readonly clock: ClockPort,
        @Inject(RECIPE_ID_GENERATOR) private readonly ids: RecipeIdGeneratorPort,
    ) {}

    async execute(userId: string, id: string): Promise<DeleteRecipeResult> {
        const now = this.clock.now();
        return this.tx.run((tx) => this.applyInTransaction(tx, userId, id, now));
    }

    private async applyInTransaction(
        tx: RecipeTx,
        userId: string,
        id: string,
        now: Date,
    ): Promise<DeleteRecipeResult> {
        const recipe = await tx.recipes.findById(id);
        // 남의 레시피는 존재 자체를 알리지 않는다.
        if (recipe === null || recipe.userId !== userId) throw new NotFoundException("Recipe not found");
        recipe.delete(now);
        await tx.recipes.upsert(recipe);
        // 배출기가 지운 레시피를 조회로 찾지 못해 검색 문서를 지운다.
        await enqueueRecipeIndex(tx, this.ids.next(), userId, recipe.id, now);
        return { deleted: true, id: recipe.id };
    }
}
