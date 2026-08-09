import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_STATUS } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeTransaction } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import {
    FixedClock,
    SequentialIdGenerator,
    recipeRow,
} from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { DismissRecipeUseCase } from "./dismiss.recipe.usecase.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let tx: InMemoryRecipeTransaction;
let target: DismissRecipeUseCase;

beforeEach(() => {
    tx = new InMemoryRecipeTransaction();
    target = new DismissRecipeUseCase(tx, new FixedClock(NOW), new SequentialIdGenerator("outbox"));
});

describe("후보 레시피를 보류한다", () => {
    it("상태를 dismissed 로 옮기고 해소 시각을 적는다", async () => {
        tx.recipes.seed(recipeRow());

        const { recipe } = await target.execute("local", "recipe-1");

        expect({ status: recipe.status, resolvedAt: recipe.resolvedAt }).toEqual({
            status: RECIPE_STATUS.dismissed,
            resolvedAt: NOW.toISOString(),
        });
    });

    it("보류와 같은 커밋에 색인 반영을 적재한다", async () => {
        tx.recipes.seed(recipeRow());

        await target.execute("local", "recipe-1");

        expect(tx.searchOutbox.all().map((row) => row.targetId)).toEqual(["recipe-1"]);
    });

    it("후보가 아닌 레시피의 보류를 recipe.not-candidate 로 거절한다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.retired }));

        await expect(target.execute("local", "recipe-1")).rejects.toMatchObject({
            code: "recipe.not-candidate",
        });
    });

    it("남의 레시피는 없는 것과 같은 404 로 감춘다", async () => {
        tx.recipes.seed(recipeRow({ userId: "other" }));

        await expect(target.execute("local", "recipe-1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
