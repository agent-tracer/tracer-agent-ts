import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RECIPE_STAGE, type RecipeStage } from "~agent-worker/domain/recipe/port/recipe.stage.output.port.js";
import { RunRecipeStageUsecase } from "./run.recipe.stage.usecase.js";

const PLAN = z.object({ probes: z.array(z.string()) });

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");

class InMemoryStageOutputs {
    readonly saved: { jobId: string; stage: string; slot: string; payload: unknown }[] = [];
    private readonly rows = new Map<string, unknown>();

    constructor(seed: Record<string, unknown> = {}) {
        for (const [key, value] of Object.entries(seed)) this.rows.set(key, value);
    }

    find(jobId: string, stage: RecipeStage, slot: string): Promise<unknown> {
        return Promise.resolve(this.rows.get(`${jobId}:${stage}:${slot}`) ?? null);
    }

    save(jobId: string, stage: RecipeStage, slot: string, payload: unknown): Promise<void> {
        this.saved.push({ jobId, stage, slot, payload });
        this.rows.set(`${jobId}:${stage}:${slot}`, payload);
        return Promise.resolve();
    }

    clear(jobId: string): Promise<void> {
        for (const key of [...this.rows.keys()]) if (key.startsWith(`${jobId}:`)) this.rows.delete(key);
        return Promise.resolve();
    }
}

function usecase(outputs: InMemoryStageOutputs): RunRecipeStageUsecase {
    return new RunRecipeStageUsecase(outputs, {
        now: () => FIXED_NOW,
        nowMs: () => FIXED_NOW.getTime(),
        nowIso: () => FIXED_NOW.toISOString(),
    });
}

describe("잡 단계의 산출", () => {
    it("앞선 시도가 낸 산출이 있으면 그 단계를 다시 실행하지 않는다", async () => {
        const outputs = new InMemoryStageOutputs({ "j1:survey:-": { probes: ["timeline"] } });
        let calls = 0;

        const plan = await usecase(outputs).execute("j1", RECIPE_STAGE.survey, "-", PLAN, () => {
            calls += 1;
            return Promise.resolve({ probes: [] });
        });

        expect(calls).toBe(0);
        expect(plan.probes).toEqual(["timeline"]);
    });

    it("처음 도는 단계는 실행하고 그 산출을 원장에 적는다", async () => {
        const outputs = new InMemoryStageOutputs();

        await usecase(outputs).execute("j1", RECIPE_STAGE.survey, "-", PLAN, () =>
            Promise.resolve({ probes: ["rules"] }),
        );

        expect(outputs.saved).toEqual([
            { jobId: "j1", stage: "survey", slot: "-", payload: { probes: ["rules"] } },
        ]);
    });

    it("판이 바뀌어 되살릴 수 없는 산출은 다시 실행한다", async () => {
        const outputs = new InMemoryStageOutputs({ "j1:survey:-": { legacyShape: true } });
        let calls = 0;

        await usecase(outputs).execute("j1", RECIPE_STAGE.survey, "-", PLAN, () => {
            calls += 1;
            return Promise.resolve({ probes: [] });
        });

        expect(calls).toBe(1);
    });

    it("같은 단계의 다른 자리는 서로의 산출을 쓰지 않는다", async () => {
        const outputs = new InMemoryStageOutputs({ "j1:probe:timeline": { probes: ["a"] } });
        let calls = 0;

        await usecase(outputs).execute("j1", RECIPE_STAGE.probe, "rules", PLAN, () => {
            calls += 1;
            return Promise.resolve({ probes: [] });
        });

        expect(calls).toBe(1);
    });

    it("종결한 잡의 산출은 지운다", async () => {
        const outputs = new InMemoryStageOutputs({ "j1:survey:-": { probes: ["timeline"] } });

        await outputs.clear("j1");

        expect(await outputs.find("j1", RECIPE_STAGE.survey, "-")).toBeNull();
    });
});
