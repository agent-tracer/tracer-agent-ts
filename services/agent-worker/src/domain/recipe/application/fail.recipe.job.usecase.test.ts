import { describe, expect, it } from "vitest";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import {
    CapturingRecipeNotification,
    fixedClock,
    InMemoryRecipeRepository,
    seedRepository,
} from "../port/__fakes__/recipe.test-support.js";
import { FailRecipeJobUsecase } from "./fail.recipe.job.usecase.js";

describe("FailRecipeJobUsecase", () => {
    it("잡을 실패로 종결하고 오류를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingRecipeNotification();
        const target = new FailRecipeJobUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", message: "rate limited" });

        expect(repository.failures).toEqual([{ jobId: "job-1", message: "rate limited" }]);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.failed,
            error: "rate limited",
        });
    });

    it("긴 오류 메시지를 제한 길이로 줄인다", async () => {
        const repository = seedRepository();
        const target = new FailRecipeJobUsecase(
            repository,
            new CapturingRecipeNotification(),
            fixedClock,
        );

        await target.execute({ jobId: "job-1", message: "x".repeat(1_200) });

        expect(repository.failures[0]?.message).toHaveLength(1_003);
    });

    it("종결된 잡은 알리지 않는다", async () => {
        const notification = new CapturingRecipeNotification();
        const target = new FailRecipeJobUsecase(
            new InMemoryRecipeRepository(),
            notification,
            fixedClock,
        );

        await target.execute({ jobId: "job-1", message: "boom" });

        expect(notification.published).toEqual([]);
    });
});
