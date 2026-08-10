import { AGENT_BACKEND } from "@tracer-agent/llm";
import type { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import type { RecipeApplicationRepositoryPort } from "~agent-api/domain/recipe/port/recipe.repository.port.js";

/** 실물의 (backend, id) 기본 키를 열쇠로 흉내 내며 같은 열쇠의 행은 거절하지 않고 덮는다. */
function rowKey(application: RecipeApplication): string {
    return `${application.backend} ${application.id}`;
}

/** 적용 이력의 대역이며 조회가 자기 축의 행만 내는 실물의 제약까지 흉내 낸다. */
export class InMemoryRecipeApplicationRepository implements RecipeApplicationRepositoryPort {
    private readonly rows = new Map<string, RecipeApplication>();

    seed(...applications: readonly RecipeApplication[]): void {
        for (const application of applications) this.rows.set(rowKey(application), application);
    }

    /** 두 축의 행을 함께 내므로 축을 거른 조회의 결과와 비교할 수 있다. */
    all(): readonly RecipeApplication[] {
        return [...this.rows.values()];
    }

    private ownAxis(): readonly RecipeApplication[] {
        return this.all().filter((application) => application.backend === AGENT_BACKEND);
    }

    findByRecipe(recipeId: string): Promise<RecipeApplication[]> {
        const rows = this.ownAxis()
            .filter((application) => application.recipeId === recipeId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        return Promise.resolve(rows);
    }

    findByTask(taskId: string): Promise<RecipeApplication[]> {
        return Promise.resolve(this.ownAxis().filter((application) => application.taskId === taskId));
    }

    upsert(application: RecipeApplication): Promise<void> {
        this.rows.set(rowKey(application), application);
        return Promise.resolve();
    }
}
