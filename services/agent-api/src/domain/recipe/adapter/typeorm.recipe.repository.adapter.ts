import { IsNull, type Repository } from "typeorm";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";
import type { RecipeStatus } from "~agent-api/domain/recipe/model/recipe.const.js";
import type { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";
import type { RecipeRepositoryPort } from "~agent-api/domain/recipe/port/recipe.repository.port.js";
import { toRecipe, toRecipeRow, type RecipeEntity } from "./recipe.entity.js";

/** 지운 레시피는 어느 조회에도 잡히지 않는다. */
export class TypeOrmRecipeRepository implements RecipeRepositoryPort {
    constructor(private readonly repo: Repository<RecipeEntity>) {}

    async findById(id: string): Promise<Recipe | null> {
        const row = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
        return row === null ? null : toRecipe(row);
    }

    async findByStatus(userId: string, status: RecipeStatus): Promise<Recipe[]> {
        const rows = await this.repo.find({
            where: { userId, status, deletedAt: IsNull() },
            order: { updatedAt: "DESC" },
        });
        return rows.map(toRecipe);
    }

    async upsert(recipe: Recipe): Promise<void> {
        await upsertByKeys(this.repo, toRecipeRow(recipe), ["id"]);
    }
}
