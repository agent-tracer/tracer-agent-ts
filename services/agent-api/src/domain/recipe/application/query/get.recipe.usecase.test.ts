import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_OUTCOME } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeApplicationRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { InMemoryRecipeRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import { applicationRow, recipeRow } from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { GetRecipeUseCase } from "./get.recipe.usecase.js";

let recipes: InMemoryRecipeRepository;
let applications: InMemoryRecipeApplicationRepository;
let target: GetRecipeUseCase;

beforeEach(() => {
    recipes = new InMemoryRecipeRepository();
    applications = new InMemoryRecipeApplicationRepository();
    target = new GetRecipeUseCase(recipes, applications);
});

describe("레시피 하나를 전문과 적용 이력까지 조회한다", () => {
    it("레시피와 그 적용 이력을 함께 낸다", async () => {
        recipes.seed(recipeRow());
        applications.seed(applicationRow());

        const detail = await target.execute("local", "recipe-1");

        expect(detail?.recipe.id).toBe("recipe-1");
        expect(detail?.applications.map((application) => application.id)).toEqual(["application-1"]);
    });

    it("자기보고가 붙은 적용만 성공률의 분모에 든다", async () => {
        recipes.seed(recipeRow());
        applications.seed(
            applicationRow({ id: "application-1", outcome: RECIPE_OUTCOME.completed }),
            applicationRow({ id: "application-2", outcome: RECIPE_OUTCOME.abandoned }),
            applicationRow({ id: "application-3" }),
        );

        const detail = await target.execute("local", "recipe-1");

        expect(detail?.stats).toEqual({ applicationCount: 3, decidedCount: 2, successRate: 0.5 });
    });

    it("자기보고가 하나도 없으면 성공률은 0 이다", async () => {
        recipes.seed(recipeRow());
        applications.seed(applicationRow());

        const detail = await target.execute("local", "recipe-1");

        expect(detail?.stats).toEqual({ applicationCount: 1, decidedCount: 0, successRate: 0 });
    });

    it("남의 레시피는 없는 것으로 본다", async () => {
        recipes.seed(recipeRow({ userId: "other" }));

        await expect(target.execute("local", "recipe-1")).resolves.toBeNull();
    });
});
