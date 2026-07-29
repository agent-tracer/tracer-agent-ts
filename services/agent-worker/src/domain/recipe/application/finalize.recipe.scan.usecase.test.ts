import { describe, expect, it } from "vitest";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import {
    CapturingRecipeNotification,
    fixedClock,
    recipeObservation,
    seedRepository,
} from "../port/__fakes__/recipe.test-support.js";
import { FinalizeRecipeScanUsecase } from "./finalize.recipe.scan.usecase.js";
import type { RecipeScanGenerateOutput } from "./scan.recipe.usecase.js";

function output(): RecipeScanGenerateOutput {
    return {
        modelUsed: "claude-sonnet-4-6",
        durationMs: 900,
        costUsd: 0.4,
        numTurns: 3,
        usage: null,
        attempt: 1,
        recipes: [],
        jobSteps: [],
        observation: recipeObservation(),
    };
}

describe("FinalizeRecipeScanUsecase", () => {
    it("후보를 저장하고 완료를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingRecipeNotification();
        const target = new FinalizeRecipeScanUsecase(repository, notification, fixedClock);

        await target.execute({
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.ko,
            output: output(),
        });

        expect(repository.commits).toHaveLength(1);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.completed,
            summary: "No recipe candidates produced",
        });
    });

    it("다른 전이가 먼저 잡을 종결하면 알리지 않는다", async () => {
        const repository = seedRepository();
        repository.commitWins = false;
        const notification = new CapturingRecipeNotification();
        const target = new FinalizeRecipeScanUsecase(repository, notification, fixedClock);

        await target.execute({
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.auto,
            output: output(),
        });

        expect(notification.published).toEqual([]);
    });
});
