import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_STATUS } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeTransaction } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import {
    FixedClock,
    SequentialIdGenerator,
    recipeRow,
} from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { AcceptRecipeUseCase } from "./accept.recipe.usecase.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let tx: InMemoryRecipeTransaction;
let target: AcceptRecipeUseCase;

beforeEach(() => {
    tx = new InMemoryRecipeTransaction();
    target = new AcceptRecipeUseCase(tx, new FixedClock(NOW), new SequentialIdGenerator("outbox"));
});

describe("후보 레시피를 채택한다", () => {
    it("상태를 active 로 옮기고 갱신 시각과 해소 시각을 함께 적는다", async () => {
        tx.recipes.seed(recipeRow());

        const { recipe } = await target.execute("local", "recipe-1");

        expect({ status: recipe.status, updatedAt: recipe.updatedAt, resolvedAt: recipe.resolvedAt }).toEqual({
            status: RECIPE_STATUS.active,
            updatedAt: NOW.toISOString(),
            resolvedAt: NOW.toISOString(),
        });
    });

    it("채택과 같은 커밋에 색인 반영을 적재한다", async () => {
        tx.recipes.seed(recipeRow());

        await target.execute("local", "recipe-1");

        expect(tx.searchOutbox.all().map((row) => row.targetId)).toEqual(["recipe-1"]);
    });

    it("같은 사용자의 부모를 superseded 로 옮기고 부모의 색인 반영도 적재한다", async () => {
        tx.recipes.seed(
            recipeRow({ id: "recipe-2", parentRecipeId: "recipe-1", rev: 2 }),
            recipeRow({ id: "recipe-1", status: RECIPE_STATUS.active }),
        );

        await target.execute("local", "recipe-2");

        const parent = tx.recipes.all().find((row) => row.id === "recipe-1");
        expect(parent?.status).toBe(RECIPE_STATUS.superseded);
        expect(tx.searchOutbox.all().map((row) => row.targetId).sort()).toEqual(["recipe-1", "recipe-2"]);
    });

    it("부모가 남의 것이면 거절하지 않고 부모를 건드리지 않는다", async () => {
        tx.recipes.seed(
            recipeRow({ id: "recipe-2", parentRecipeId: "recipe-1" }),
            recipeRow({ id: "recipe-1", userId: "other", status: RECIPE_STATUS.active }),
        );

        await target.execute("local", "recipe-2");

        const parent = tx.recipes.all().find((row) => row.id === "recipe-1");
        expect(parent?.status).toBe(RECIPE_STATUS.active);
    });

    it("후보가 아닌 레시피의 채택을 recipe.not-candidate 로 거절한다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active }));

        await expect(target.execute("local", "recipe-1")).rejects.toMatchObject({
            code: "recipe.not-candidate",
            httpStatus: 409,
        });
    });

    it("거절하면 색인 적재도 남기지 않는다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active }));

        await expect(target.execute("local", "recipe-1")).rejects.toThrow();
        expect(tx.searchOutbox.all()).toEqual([]);
    });

    it("남의 레시피는 없는 것과 같은 404 로 감춘다", async () => {
        tx.recipes.seed(recipeRow({ userId: "other" }));

        await expect(target.execute("local", "recipe-1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
