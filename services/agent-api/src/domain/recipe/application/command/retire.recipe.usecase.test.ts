import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_STATUS } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeTransaction } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import {
    FixedClock,
    SequentialIdGenerator,
    recipeRow,
} from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { RetireRecipeUseCase } from "./retire.recipe.usecase.js";

const ACCEPTED_AT = new Date("2026-01-05T00:00:00.000Z");
const NOW = new Date("2026-02-01T00:00:00.000Z");

let tx: InMemoryRecipeTransaction;
let target: RetireRecipeUseCase;

beforeEach(() => {
    tx = new InMemoryRecipeTransaction();
    target = new RetireRecipeUseCase(tx, new FixedClock(NOW), new SequentialIdGenerator("outbox"));
});

describe("쓰이던 레시피를 폐기한다", () => {
    it("상태를 retired 로 옮기고 갱신 시각만 적는다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active, resolvedAt: ACCEPTED_AT }));

        const { recipe } = await target.execute("local", "recipe-1");

        expect({ status: recipe.status, updatedAt: recipe.updatedAt, resolvedAt: recipe.resolvedAt }).toEqual({
            status: RECIPE_STATUS.retired,
            updatedAt: NOW.toISOString(),
            resolvedAt: ACCEPTED_AT.toISOString(),
        });
    });

    it("폐기와 같은 커밋에 색인 반영을 적재한다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active }));

        await target.execute("local", "recipe-1");

        expect(tx.searchOutbox.all().map((row) => row.targetId)).toEqual(["recipe-1"]);
    });

    it("채택되지 않은 레시피의 폐기를 recipe.not-active 로 거절한다", async () => {
        tx.recipes.seed(recipeRow());

        await expect(target.execute("local", "recipe-1")).rejects.toMatchObject({
            code: "recipe.not-active",
        });
    });

    it("남의 레시피는 없는 것과 같은 404 로 감춘다", async () => {
        tx.recipes.seed(recipeRow({ userId: "other", status: RECIPE_STATUS.active }));

        await expect(target.execute("local", "recipe-1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
