import type { Repository } from "typeorm";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";
import type { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import type { RecipeApplicationRepositoryPort } from "~agent-api/domain/recipe/port/recipe.repository.port.js";
import {
    toRecipeApplication,
    toRecipeApplicationRow,
    type RecipeApplicationEntity,
} from "./recipe.application.entity.js";

export class TypeOrmRecipeApplicationRepository implements RecipeApplicationRepositoryPort {
    constructor(private readonly repo: Repository<RecipeApplicationEntity>) {}

    async findByRecipe(recipeId: string): Promise<RecipeApplication[]> {
        const rows = await this.repo.find({ where: { recipeId }, order: { createdAt: "DESC" } });
        return rows.map(toRecipeApplication);
    }

    async findByTask(taskId: string): Promise<RecipeApplication[]> {
        const rows = await this.repo.find({ where: { taskId } });
        return rows.map(toRecipeApplication);
    }

    async upsert(application: RecipeApplication): Promise<void> {
        await upsertByKeys(this.repo, toRecipeApplicationRow(application), ["id"]);
    }
}
