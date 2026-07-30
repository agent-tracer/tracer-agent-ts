import { describe, expect, it } from "vitest";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import {
    CapturingRecipeNotification,
    fixedClock,
    InMemoryRecipeOutput,
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
    it("후보를 창구에 맡기고 완료를 알린다", async () => {
        const repository = seedRepository();
        const outputs = new InMemoryRecipeOutput();
        const notification = new CapturingRecipeNotification();
        const target = new FinalizeRecipeScanUsecase(repository, outputs, notification, fixedClock);

        await target.execute({
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.ko,
            output: output(),
        });

        expect(outputs.batches[0]?.sourceJobId).toBe("job-1");
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
        const target = new FinalizeRecipeScanUsecase(repository, new InMemoryRecipeOutput(), notification, fixedClock);

        await target.execute({
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.auto,
            output: output(),
        });

        expect(notification.published).toEqual([]);
    });

    it("산출물 창구가 거절하면 잡을 종결하지 않는다", async () => {
        const repository = seedRepository();
        const outputs = new InMemoryRecipeOutput();
        outputs.failure = new Error("tracer_api_failed");
        const target = new FinalizeRecipeScanUsecase(
            repository,
            outputs,
            new CapturingRecipeNotification(),
            fixedClock,
        );

        await expect(
            target.execute({
                jobId: "job-1",
                userId: "user-1",
                sourceTaskId: "task-1",
                language: OUTPUT_LANGUAGE.ko,
                output: output(),
            }),
        ).rejects.toThrow();
        expect(repository.commits).toEqual([]);
    });

    it("같은 잡을 다시 종결해도 후보를 두 벌 만들지 않는다", async () => {
        const repository = seedRepository();
        const outputs = new InMemoryRecipeOutput();
        const target = new FinalizeRecipeScanUsecase(
            repository,
            outputs,
            new CapturingRecipeNotification(),
            fixedClock,
        );
        const input = {
            jobId: "job-1",
            userId: "user-1",
            sourceTaskId: "task-1",
            language: OUTPUT_LANGUAGE.ko,
            output: output(),
        };

        await target.execute(input);
        await target.execute(input);

        expect(outputs.batches).toHaveLength(1);
    });
});
