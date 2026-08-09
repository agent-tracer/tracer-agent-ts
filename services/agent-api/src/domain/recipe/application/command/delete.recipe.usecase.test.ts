import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_STATUS } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeTransaction } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import {
    FixedClock,
    SequentialIdGenerator,
    recipeRow,
} from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { DeleteRecipeUseCase } from "./delete.recipe.usecase.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let tx: InMemoryRecipeTransaction;
let target: DeleteRecipeUseCase;

beforeEach(() => {
    tx = new InMemoryRecipeTransaction();
    target = new DeleteRecipeUseCase(tx, new FixedClock(NOW), new SequentialIdGenerator("outbox"));
});

describe("지울 수 있는 레시피를 지운다", () => {
    it("행을 지우지 않고 지운 시각을 적는다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.dismissed }));

        await expect(target.execute("local", "recipe-1")).resolves.toEqual({ deleted: true, id: "recipe-1" });
        expect(tx.recipes.all()[0]?.deletedAt).toEqual(NOW);
    });

    it("지운 레시피는 그 뒤 조회에 잡히지 않는다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.retired }));

        await target.execute("local", "recipe-1");

        await expect(tx.recipes.findById("recipe-1")).resolves.toBeNull();
    });

    it("배출기가 문서를 지우도록 색인 반영을 적재한다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.retired }));

        await target.execute("local", "recipe-1");

        expect(tx.searchOutbox.all().map((row) => row.targetId)).toEqual(["recipe-1"]);
    });

    it("보류하거나 폐기하지 않은 레시피의 삭제를 recipe.not-deletable 로 거절한다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active }));

        await expect(target.execute("local", "recipe-1")).rejects.toMatchObject({
            code: "recipe.not-deletable",
            httpStatus: 400,
        });
    });

    it("남의 레시피는 없는 것과 같은 404 로 감춘다", async () => {
        tx.recipes.seed(recipeRow({ userId: "other", status: RECIPE_STATUS.retired }));

        await expect(target.execute("local", "recipe-1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
