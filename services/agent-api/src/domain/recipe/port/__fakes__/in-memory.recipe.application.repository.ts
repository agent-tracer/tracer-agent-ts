import type { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import type { RecipeApplicationRepositoryPort } from "~agent-api/domain/recipe/port/recipe.repository.port.js";

/** 적용 이력의 대역이며 실물이 갖는 기본 키의 유일 제약은 흉내 내지 않고 같은 식별자를 덮어쓴다. */
export class InMemoryRecipeApplicationRepository implements RecipeApplicationRepositoryPort {
    private readonly rows = new Map<string, RecipeApplication>();

    seed(...applications: readonly RecipeApplication[]): void {
        for (const application of applications) this.rows.set(application.id, application);
    }

    all(): readonly RecipeApplication[] {
        return [...this.rows.values()];
    }

    findByRecipe(recipeId: string): Promise<RecipeApplication[]> {
        const rows = this.all()
            .filter((application) => application.recipeId === recipeId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        return Promise.resolve(rows);
    }

    findByTask(taskId: string): Promise<RecipeApplication[]> {
        return Promise.resolve(this.all().filter((application) => application.taskId === taskId));
    }

    upsert(application: RecipeApplication): Promise<void> {
        this.rows.set(application.id, application);
        return Promise.resolve();
    }
}
