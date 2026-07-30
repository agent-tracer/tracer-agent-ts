import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { GetLatestJobUseCase } from "./get.latest.job.usecase.js";

const EARLIER = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-01-02T00:00:00.000Z");

function makeUseCase(): GetLatestJobUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(
        Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, EARLIER),
        Job.create("job-2", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, LATER),
    );
    return new GetLatestJobUseCase(jobs);
}

describe("GetLatestJobUseCase", () => {
    it("같은 태스크의 잡 중 더 최근 것을 준다", async () => {
        const { job } = await makeUseCase().execute("local", JOB_KIND.recipeScan, "task-1");

        expect(job?.id).toBe("job-2");
    });

    it("다른 종류를 물으면 비운다", async () => {
        const { job } = await makeUseCase().execute("local", JOB_KIND.ruleGeneration, "task-1");

        expect(job).toBeNull();
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        const { job } = await makeUseCase().execute("other", JOB_KIND.recipeScan, "task-1");

        expect(job).toBeNull();
    });
});
