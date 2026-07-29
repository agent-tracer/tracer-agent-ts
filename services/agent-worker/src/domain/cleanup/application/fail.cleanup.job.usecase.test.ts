import { describe, expect, it } from "vitest";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import {
    CapturingCleanupNotification,
    fixedClock,
    InMemoryCleanupRepository,
    seedRepository,
} from "../port/__fakes__/cleanup.test-support.js";
import { FailCleanupJobUsecase } from "./fail.cleanup.job.usecase.js";

describe("FailCleanupJobUsecase", () => {
    it("잡을 실패로 종결하고 오류를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingCleanupNotification();
        const target = new FailCleanupJobUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", message: "rate limited" });

        expect(repository.failures).toEqual([{ jobId: "job-1", message: "rate limited" }]);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.failed,
            error: "rate limited",
        });
    });

    it("긴 오류 메시지를 제한 길이로 줄인다", async () => {
        const repository = seedRepository();
        const target = new FailCleanupJobUsecase(
            repository,
            new CapturingCleanupNotification(),
            fixedClock,
        );

        await target.execute({ jobId: "job-1", message: "x".repeat(1_200) });

        expect(repository.failures[0]?.message).toHaveLength(1_003);
    });

    it("종결된 잡은 알리지 않는다", async () => {
        const notification = new CapturingCleanupNotification();
        const target = new FailCleanupJobUsecase(
            new InMemoryCleanupRepository(),
            notification,
            fixedClock,
        );

        await target.execute({ jobId: "job-1", message: "boom" });

        expect(notification.published).toEqual([]);
    });
});
