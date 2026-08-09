import { beforeEach, describe, expect, it } from "vitest";
import { RECIPE_INJECTED_VIA } from "~agent-api/domain/recipe/model/recipe.const.js";
import { RECIPE_INJECTED_EVENT_KIND, type LedgerRecord } from "~agent-api/domain/recipe/model/ledger.record.js";
import { InMemoryRecipeApplicationRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { applicationRow } from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { RecipeProjection } from "./recipe.projection.js";

const OCCURRED_AT = new Date("2026-01-01T00:03:00.000Z");

let applications: InMemoryRecipeApplicationRepository;
let target: RecipeProjection;

function record(overrides: Partial<LedgerRecord> = {}): LedgerRecord {
    return {
        id: "event-9",
        seq: "42",
        userId: "local",
        taskId: "task-1",
        kind: RECIPE_INJECTED_EVENT_KIND,
        occurredAt: OCCURRED_AT,
        payload: { applicationId: "application-9", recipeId: "recipe-1" },
        ...overrides,
    };
}

beforeEach(() => {
    applications = new InMemoryRecipeApplicationRepository();
    target = new RecipeProjection(applications);
});

describe("레시피 주입 사건을 적용 이력으로 투영한다", () => {
    it("사건의 칸을 적용 이력의 칸으로 옮긴다", async () => {
        await target.handle(record());

        expect(applications.all()[0]).toMatchObject({
            id: "application-9",
            userId: "local",
            recipeId: "recipe-1",
            taskId: "task-1",
            injectedVia: RECIPE_INJECTED_VIA.pull,
            outcome: null,
            note: null,
            anchorEventId: "event-9",
            anchorSeq: "42",
            createdAt: OCCURRED_AT,
        });
    });

    it("사건이 실은 주입 경로를 그대로 적는다", async () => {
        await target.handle(
            record({ payload: { applicationId: "a", recipeId: "recipe-1", injectedVia: "manual" } }),
        );

        expect(applications.all()[0]?.injectedVia).toBe(RECIPE_INJECTED_VIA.manual);
    });

    it("고르지 않은 종류는 아무것도 하지 않는다", async () => {
        await target.handle(record({ kind: "agent_tracer.task.created" }));

        expect(applications.all()).toEqual([]);
    });

    it("행의 식별자가 없으면 행을 만들지 않는다", async () => {
        await target.handle(record({ payload: { recipeId: "recipe-1" } }));

        expect(applications.all()).toEqual([]);
    });

    it("대상 레시피가 없으면 행을 만들지 않는다", async () => {
        await target.handle(record({ payload: { applicationId: "application-9" } }));

        expect(applications.all()).toEqual([]);
    });

    it("같은 태스크에 같은 레시피의 행이 이미 있으면 새로 만들지 않는다", async () => {
        applications.seed(applicationRow());

        await target.handle(record());

        expect(applications.all().map((row) => row.id)).toEqual(["application-1"]);
    });

    it("같은 사건이 다시 와도 행이 늘지 않는다", async () => {
        await target.handle(record());
        await target.handle(record());

        expect(applications.all()).toHaveLength(1);
    });

    it("다른 레시피의 주입은 같은 태스크에서도 행을 따로 만든다", async () => {
        applications.seed(applicationRow({ recipeId: "recipe-other" }));

        await target.handle(record());

        expect(applications.all()).toHaveLength(2);
    });
});
