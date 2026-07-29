import { describe, expect, it } from "vitest";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import {
    CapturingCleanupNotification,
    cleanupObservation,
    fixedClock,
    seedRepository,
} from "../port/__fakes__/cleanup.test-support.js";
import { FinalizeTaskCleanupUsecase, type TaskCleanupFinalizeOutput } from "./finalize.task.cleanup.usecase.js";

function output(): TaskCleanupFinalizeOutput {
    return {
        modelUsed: "claude-sonnet-4-6",
        durationMs: 900,
        costUsd: 0.4,
        numTurns: 3,
        usage: null,
        attempt: 1,
        suggestions: [],
        jobSteps: [],
        observation: cleanupObservation(),
    };
}

describe("FinalizeTaskCleanupUsecase", () => {
    it("제안을 저장하고 완료를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingCleanupNotification();
        const target = new FinalizeTaskCleanupUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", tasksScanned: 2, output: output() });

        expect(repository.commits).toHaveLength(1);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.completed,
            summary: "No cleanup suggestions for 2 tasks",
        });
    });

    it("후보가 없어 실행을 생략했으면 빈 사용량으로 종결한다", async () => {
        const repository = seedRepository();
        const notification = new CapturingCleanupNotification();
        const target = new FinalizeTaskCleanupUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", tasksScanned: 0, output: null });

        expect(repository.commits[0]?.usage).toEqual({});
        expect(notification.published[0]?.payload["durationMs"]).toBe(0);
    });

    it("다른 전이가 먼저 잡을 종결하면 알리지 않는다", async () => {
        const repository = seedRepository();
        repository.commitWins = false;
        const notification = new CapturingCleanupNotification();
        const target = new FinalizeTaskCleanupUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", userId: "user-1", tasksScanned: 2, output: output() });

        expect(notification.published).toEqual([]);
    });
});
