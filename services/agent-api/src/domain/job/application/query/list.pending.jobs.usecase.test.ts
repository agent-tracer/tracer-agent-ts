import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { ListPendingJobsUseCase } from "./list.pending.jobs.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): ListPendingJobsUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(
        Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, NOW),
        Job.create("job-2", "other", JOB_KIND.recipeScan, { taskId: "task-2" }, NOW),
        Job.create("job-3", "local", JOB_KIND.taskCleanup, {}, NOW),
    );
    return new ListPendingJobsUseCase(jobs);
}

describe("ListPendingJobsUseCase", () => {
    it("이 사용자의 대기 잡만 준다", async () => {
        const { items } = await makeUseCase().execute("local", JOB_KIND.recipeScan);

        expect(items.map((item) => item.id)).toEqual(["job-1"]);
    });

    it("다른 종류는 세지 않는다", async () => {
        const { items } = await makeUseCase().execute("local", JOB_KIND.titleSuggestion);

        expect(items).toEqual([]);
    });
});
