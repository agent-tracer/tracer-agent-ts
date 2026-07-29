import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { graphJobExecution } from "~agent-api/domain/job/port/__fakes__/graph.job.execution.fixture.js";
import { InMemoryGraphJobExecutionReader } from "~agent-api/domain/job/port/__fakes__/in-memory.graph.job.execution.reader.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { GetLatestJobUseCase } from "./get.latest.job.usecase.js";

const EARLIER = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-01-02T00:00:00.000Z");

function makeUseCase(graphCreatedAt: Date): GetLatestJobUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, EARLIER));
    const executions = new InMemoryGraphJobExecutionReader();
    executions.seed(graphJobExecution({
        id: "exec-1", userId: "local", kind: "recipe-scan", status: "queued", taskId: "task-1", createdAt: graphCreatedAt,
    }));
    return new GetLatestJobUseCase(jobs, executions);
}

describe("GetLatestJobUseCase", () => {
    it("두 원장 중 더 최근 것을 준다", async () => {
        const { job } = await makeUseCase(LATER).execute("local", JOB_KIND.recipeScan, "task-1");

        expect(job?.id).toBe("exec-1");
    });

    it("잡 원장이 더 최근이면 그것을 준다", async () => {
        const { job } = await makeUseCase(EARLIER).execute("local", JOB_KIND.recipeScan, "task-1");

        expect(job?.id).toBe("job-1");
    });

    it("실행 원장에 대응이 없는 종류는 잡 원장만 본다", async () => {
        const { job } = await makeUseCase(LATER).execute("local", JOB_KIND.ruleGeneration, "task-1");

        expect(job).toBeNull();
    });

    it("둘 다 없으면 비운다", async () => {
        const { job } = await makeUseCase(LATER).execute("other", JOB_KIND.recipeScan, "task-1");

        expect(job).toBeNull();
    });
});
