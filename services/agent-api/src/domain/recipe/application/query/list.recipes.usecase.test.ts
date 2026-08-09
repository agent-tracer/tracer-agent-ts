import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_STATUS } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeApplicationRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { InMemoryRecipeRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import { RecordingTaskReader, recipeRow } from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { ListRecipesUseCase } from "./list.recipes.usecase.js";

let recipes: InMemoryRecipeRepository;
let applications: InMemoryRecipeApplicationRepository;
let tasks: RecordingTaskReader;
let target: ListRecipesUseCase;

function sliced(id: string, status: (typeof RECIPE_STATUS)[keyof typeof RECIPE_STATUS], taskIds: string[]) {
    return recipeRow({ id, status, contributingSlices: taskIds.map((taskId) => ({ taskId })) });
}

beforeEach(() => {
    recipes = new InMemoryRecipeRepository();
    applications = new InMemoryRecipeApplicationRepository();
    tasks = new RecordingTaskReader();
    target = new ListRecipesUseCase(recipes, applications, tasks);
});

describe("레시피를 상태로 걸러 조회한다", () => {
    it("상태를 실으면 그 상태의 레시피만 낸다", async () => {
        recipes.seed(sliced("recipe-1", RECIPE_STATUS.candidate, []), sliced("recipe-2", RECIPE_STATUS.active, []));

        const result = await target.execute("local", RECIPE_STATUS.active);

        expect(result.items.map((item) => item.id)).toEqual(["recipe-2"]);
    });

    it("상태를 싣지 않으면 상태 선언 순서로 이어 붙인다", async () => {
        recipes.seed(
            sliced("recipe-active", RECIPE_STATUS.active, []),
            sliced("recipe-candidate", RECIPE_STATUS.candidate, []),
            sliced("recipe-retired", RECIPE_STATUS.retired, []),
        );

        const result = await target.execute("local");

        expect(result.items.map((item) => item.id)).toEqual([
            "recipe-candidate",
            "recipe-active",
            "recipe-retired",
        ]);
    });

    it("지운 레시피는 어느 상태로 물어도 나오지 않는다", async () => {
        recipes.seed(recipeRow({ deletedAt: new Date("2026-01-02T00:00:00.000Z") }));

        const result = await target.execute("local");

        expect(result.items).toEqual([]);
    });

    it("인용된 태스크가 여럿이어도 제목을 한 번만 묻는다", async () => {
        recipes.seed(
            sliced("recipe-1", RECIPE_STATUS.candidate, ["task-1", "task-2"]),
            sliced("recipe-2", RECIPE_STATUS.candidate, ["task-2", "task-3"]),
        );
        tasks.seed("local", "task-1", "첫 태스크");
        tasks.seed("local", "task-2", "둘째 태스크");
        tasks.seed("local", "task-3", "셋째 태스크");

        await target.execute("local");

        expect(tasks.calls).toEqual([["task-1", "task-2", "task-3"]]);
    });

    it("제목을 찾지 못한 식별자는 표에 넣지 않는다", async () => {
        recipes.seed(sliced("recipe-1", RECIPE_STATUS.candidate, ["task-1", "task-없음"]));
        tasks.seed("local", "task-1", "첫 태스크");

        const result = await target.execute("local");

        expect(result.taskTitles).toEqual({ "task-1": "첫 태스크" });
    });

    it("인용된 태스크가 없으면 추적을 부르지 않는다", async () => {
        recipes.seed(sliced("recipe-1", RECIPE_STATUS.candidate, []));

        const result = await target.execute("local");

        expect({ calls: tasks.calls, taskTitles: result.taskTitles }).toEqual({ calls: [], taskTitles: {} });
    });
});
