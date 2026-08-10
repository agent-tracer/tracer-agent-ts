import { AGENT_BACKEND } from "@tracer-agent/llm";
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

    /** 축을 거르지 않으면 두 축이 만든 행이 한 목록에 함께 실려 통계가 두 축의 합이 된다. */
    async findByRecipe(recipeId: string): Promise<RecipeApplication[]> {
        const rows = await this.repo.find({
            where: { backend: AGENT_BACKEND, recipeId },
            order: { createdAt: "DESC" },
        });
        return rows.map(toRecipeApplication);
    }

    /** 축을 거르지 않으면 상대 축이 먼저 만든 행 때문에 이 축이 자기 행을 만들지 못한다. */
    async findByTask(taskId: string): Promise<RecipeApplication[]> {
        const rows = await this.repo.find({ where: { backend: AGENT_BACKEND, taskId } });
        return rows.map(toRecipeApplication);
    }

    async upsert(application: RecipeApplication): Promise<void> {
        await upsertByKeys(this.repo, toRecipeApplicationRow(application), ["backend", "id"]);
    }
}
