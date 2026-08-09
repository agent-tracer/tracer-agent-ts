import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_EDITOR, RECIPE_STATUS } from "~agent-api/domain/recipe/model/recipe.const.js";
import { InMemoryRecipeTransaction } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import {
    FixedClock,
    SequentialIdGenerator,
    recipeRow,
} from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { EditRecipeUseCase } from "./edit.recipe.usecase.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let tx: InMemoryRecipeTransaction;
let target: EditRecipeUseCase;

beforeEach(() => {
    tx = new InMemoryRecipeTransaction();
    target = new EditRecipeUseCase(tx, new FixedClock(NOW), new SequentialIdGenerator("outbox"));
});

describe("채택된 레시피의 본문을 사람이 고친다", () => {
    it("실은 칸만 고치고 나머지 칸은 그대로 둔다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active }));

        const { recipe } = await target.execute("local", "recipe-1", { title: "고친 제목" });

        expect({ title: recipe.title, intent: recipe.intent }).toEqual({
            title: "고친 제목",
            intent: "빌드를 되살린다",
        });
    });

    it("판을 하나 올리고 사람이 고쳤다는 표시를 남긴다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active, rev: 3 }));

        const { recipe } = await target.execute("local", "recipe-1", { summaryMd: "고친 요약" });

        expect({ rev: recipe.rev, userEdited: recipe.userEdited, lastEditedBy: recipe.lastEditedBy }).toEqual({
            rev: 4,
            userEdited: true,
            lastEditedBy: RECIPE_EDITOR.user,
        });
    });

    it("고침과 같은 커밋에 색인 반영을 적재한다", async () => {
        tx.recipes.seed(recipeRow({ status: RECIPE_STATUS.active }));

        await target.execute("local", "recipe-1", { title: "고친 제목" });

        expect(tx.searchOutbox.all().map((row) => row.targetId)).toEqual(["recipe-1"]);
    });

    it("채택되지 않은 레시피의 고침을 recipe.not-active 로 거절한다", async () => {
        tx.recipes.seed(recipeRow());

        await expect(target.execute("local", "recipe-1", { title: "고친 제목" })).rejects.toMatchObject({
            code: "recipe.not-active",
        });
    });

    it("남의 레시피는 없는 것과 같은 404 로 감춘다", async () => {
        tx.recipes.seed(recipeRow({ userId: "other", status: RECIPE_STATUS.active }));

        await expect(target.execute("local", "recipe-1", { title: "고친 제목" })).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });
});
