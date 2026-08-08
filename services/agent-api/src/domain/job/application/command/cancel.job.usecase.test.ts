import { describe, expect, it } from "vitest";
import { JOB_KIND, JOB_STATUS } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { FixedClock } from "~agent-api/domain/job/port/__fakes__/fixed.clock.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { RecordingJobStatusNotifier } from "~agent-api/domain/job/port/__fakes__/recording.job.status.notifier.js";
import { RecordingWorkflowDispatcher } from "~agent-api/domain/job/port/__fakes__/recording.workflow.dispatcher.js";
import { CancelJobUseCase } from "./cancel.job.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

interface Harness {
    readonly useCase: CancelJobUseCase;
    readonly jobs: InMemoryJobRepository;
    readonly dispatcher: RecordingWorkflowDispatcher;
    readonly notifier: RecordingJobStatusNotifier;
}

function makeHarness(...seeded: readonly Job[]): Harness {
    const jobs = new InMemoryJobRepository();
    jobs.seed(...(seeded.length > 0
        ? seeded
        : [Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, NOW)]));
    const dispatcher = new RecordingWorkflowDispatcher();
    const notifier = new RecordingJobStatusNotifier();
    return {
        useCase: new CancelJobUseCase(jobs, dispatcher, notifier, new FixedClock(NOW)),
        jobs,
        dispatcher,
        notifier,
    };
}

describe("CancelJobUseCase", () => {
    it("워크플로를 먼저 중단하고 잡을 취소로 적는다", async () => {
        const { useCase, dispatcher, jobs } = makeHarness();

        const job = await useCase.execute("local", "job-1");

        expect(job?.status).toBe(JOB_STATUS.canceled);
        expect(dispatcher.canceled).toEqual([{ kind: JOB_KIND.recipeScan, jobId: "job-1" }]);
        expect((await jobs.findById("job-1"))!.status).toBe(JOB_STATUS.canceled);
    });

    it("취소를 사용자에게 알린다", async () => {
        const { useCase, notifier } = makeHarness();

        await useCase.execute("local", "job-1");

        expect(notifier.notified).toEqual([{
            userId: "local",
            change: { jobId: "job-1", kind: JOB_KIND.recipeScan, status: JOB_STATUS.canceled, taskId: "task-1" },
        }]);
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        const { useCase } = makeHarness();

        await expect(useCase.execute("other", "job-1")).resolves.toBeNull();
    });

    it("이미 종결된 잡을 다시 취소하지 않는다", async () => {
        const { useCase } = makeHarness();
        await useCase.execute("local", "job-1");

        await expect(useCase.execute("local", "job-1"))
            .rejects.toMatchObject({ code: "job.not-cancelable" });
    });
});
