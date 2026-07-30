import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { GetJobUseCase } from "./get.job.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): GetJobUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, NOW));
    return new GetJobUseCase(jobs);
}

describe("GetJobUseCase", () => {
    it("원장의 잡을 준다", async () => {
        expect(await makeUseCase().execute("local", "job-1")).toMatchObject({ id: "job-1", kind: JOB_KIND.recipeScan });
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        expect(await makeUseCase().execute("other", "job-1")).toBeNull();
    });

    it("원장에 없으면 비운다", async () => {
        expect(await makeUseCase().execute("local", "없음")).toBeNull();
    });
});
