import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_INJECTED_VIA, RECIPE_OUTCOME } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeApplicationRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { InMemoryRecipeRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import {
    FixedClock,
    SequentialIdGenerator,
    applicationRow,
    recipeRow,
} from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { ReportRecipeOutcomeUseCase } from "./report.recipe.outcome.usecase.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let recipes: InMemoryRecipeRepository;
let applications: InMemoryRecipeApplicationRepository;
let target: ReportRecipeOutcomeUseCase;

beforeEach(() => {
    recipes = new InMemoryRecipeRepository();
    applications = new InMemoryRecipeApplicationRepository();
    target = new ReportRecipeOutcomeUseCase(
        recipes,
        applications,
        new FixedClock(NOW),
        new SequentialIdGenerator("generated"),
    );
    recipes.seed(recipeRow());
});

describe("레시피를 쓴 결과를 자기보고한다", () => {
    it("그 태스크에 열린 적용 이력이 있으면 그 행에 결과를 적는다", async () => {
        applications.seed(applicationRow());

        const { application } = await target.execute({
            userId: "local",
            recipeId: "recipe-1",
            taskId: "task-1",
            outcome: RECIPE_OUTCOME.completed,
            note: "그대로 따랐다",
        });

        expect({ id: application.id, outcome: application.outcome, note: application.note }).toEqual({
            id: "application-1",
            outcome: RECIPE_OUTCOME.completed,
            note: "그대로 따랐다",
        });
        expect(applications.all()).toHaveLength(1);
    });

    it("적용 이력이 없으면 manual 행 하나를 만들어 적는다", async () => {
        const { application } = await target.execute({
            userId: "local",
            recipeId: "recipe-1",
            taskId: "task-9",
            outcome: RECIPE_OUTCOME.abandoned,
        });

        expect({ injectedVia: application.injectedVia, outcome: application.outcome, note: application.note }).toEqual({
            injectedVia: RECIPE_INJECTED_VIA.manual,
            outcome: RECIPE_OUTCOME.abandoned,
            note: null,
        });
    });

    it("만든 manual 행은 사건에서 오지 않았으므로 사건 좌표가 비어 있다", async () => {
        await target.execute({
            userId: "local",
            recipeId: "recipe-1",
            taskId: "task-9",
            outcome: RECIPE_OUTCOME.completed,
        });

        const created = applications.all()[0];
        expect({ anchorEventId: created?.anchorEventId, anchorSeq: created?.anchorSeq }).toEqual({
            anchorEventId: null,
            anchorSeq: null,
        });
    });

    it("다시 보고하면 앞의 결과를 덮는다", async () => {
        applications.seed(applicationRow({ outcome: RECIPE_OUTCOME.abandoned, note: "먼저 적은 것" }));

        const { application } = await target.execute({
            userId: "local",
            recipeId: "recipe-1",
            taskId: "task-1",
            outcome: RECIPE_OUTCOME.completed,
        });

        expect({ outcome: application.outcome, note: application.note }).toEqual({
            outcome: RECIPE_OUTCOME.completed,
            note: null,
        });
    });

    it("다른 레시피의 적용 이력에는 결과를 적지 않는다", async () => {
        applications.seed(applicationRow({ recipeId: "recipe-other" }));

        const { application } = await target.execute({
            userId: "local",
            recipeId: "recipe-1",
            taskId: "task-1",
            outcome: RECIPE_OUTCOME.completed,
        });

        expect(application.id).not.toBe("application-1");
        expect(applications.all()).toHaveLength(2);
    });

    it("남의 레시피는 없는 것과 같은 404 로 감춘다", async () => {
        await expect(
            target.execute({
                userId: "other",
                recipeId: "recipe-1",
                taskId: "task-1",
                outcome: RECIPE_OUTCOME.completed,
            }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
