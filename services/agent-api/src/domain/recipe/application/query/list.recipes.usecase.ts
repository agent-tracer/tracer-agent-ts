import { Inject, Injectable } from "@nestjs/common";
import { RECIPE_STATUSES, type RecipeStatus } from "~agent-api/domain/recipe/model/recipe.const.js";
import { recipeStats } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import { citedTaskIds, type Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";
import {
    RECIPE_APPLICATION_REPOSITORY,
    RECIPE_REPOSITORY,
    type RecipeApplicationRepositoryPort,
    type RecipeRepositoryPort,
} from "~agent-api/domain/recipe/port/recipe.repository.port.js";
import {
    RECIPE_TASK_READER,
    type RecipeTaskReaderPort,
} from "~agent-api/domain/recipe/port/recipe.task.reader.port.js";
import { mapRecipe, type RecipeWithStatsDto } from "~agent-api/domain/recipe/application/recipe.support.js";

export interface ListRecipesResult {
    readonly items: readonly RecipeWithStatsDto[];
    readonly taskTitles: Readonly<Record<string, string>>;
}

/** 레시피를 상태로 걸러 내고 인용된 태스크의 제목 표를 함께 낸다. */
@Injectable()
export class ListRecipesUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_APPLICATION_REPOSITORY) private readonly applications: RecipeApplicationRepositoryPort,
        @Inject(RECIPE_TASK_READER) private readonly tasks: RecipeTaskReaderPort,
    ) {}

    async execute(userId: string, status?: RecipeStatus): Promise<ListRecipesResult> {
        const recipes = await this.collect(userId, status);
        const items: RecipeWithStatsDto[] = [];
        for (const recipe of recipes) {
            const applications = await this.applications.findByRecipe(recipe.id);
            items.push({ ...mapRecipe(recipe), stats: recipeStats(applications) });
        }
        return { items, taskTitles: await this.resolveTaskTitles(userId, recipes) };
    }

    /** 인용된 식별자를 모아 한 번에 물어 레시피 수만큼 왕복이 생기지 않게 한다. */
    private async resolveTaskTitles(
        userId: string,
        recipes: readonly Recipe[],
    ): Promise<Record<string, string>> {
        const ids = citedTaskIds(recipes);
        if (ids.length === 0) return {};
        const wanted = new Set(ids);
        const titles: Record<string, string> = {};
        for (const task of await this.tasks.findTitlesByIds(userId, ids)) {
            if (wanted.has(task.id)) titles[task.id] = task.title;
        }
        return titles;
    }

    /** 상태를 싣지 않으면 선언 순서로 이어 붙이고 전체를 다시 정렬하지 않는다. */
    private async collect(userId: string, status: RecipeStatus | undefined): Promise<Recipe[]> {
        if (status !== undefined) return this.recipes.findByStatus(userId, status);
        const groups: Recipe[][] = [];
        for (const declared of RECIPE_STATUSES) groups.push(await this.recipes.findByStatus(userId, declared));
        return groups.flat();
    }
}
