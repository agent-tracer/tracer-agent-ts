import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { graphJobExecution } from "~agent-api/domain/job/port/__fakes__/graph.job.execution.fixture.js";
import { InMemoryGraphJobExecutionReader } from "~agent-api/domain/job/port/__fakes__/in-memory.graph.job.execution.reader.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { GetJobUseCase } from "./get.job.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): GetJobUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, NOW));
    const executions = new InMemoryGraphJobExecutionReader();
    executions.seed(graphJobExecution({
        id: "exec-1", userId: "local", kind: "recipe-scan", status: "queued", taskId: "task-1", createdAt: NOW,
    }));
    return new GetJobUseCase(jobs, executions);
}

describe("GetJobUseCase", () => {
    it("잡 원장의 잡을 준다", async () => {
        expect(await makeUseCase().execute("local", "job-1")).toMatchObject({ id: "job-1", kind: JOB_KIND.recipeScan });
    });

    it("잡 원장에 없으면 실행 원장을 같은 모양으로 옮겨 준다", async () => {
        const job = await makeUseCase().execute("local", "exec-1");

        expect(job).toMatchObject({ id: "exec-1", kind: JOB_KIND.recipeScan, status: "pending", attempts: 1 });
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        expect(await makeUseCase().execute("other", "job-1")).toBeNull();
        expect(await makeUseCase().execute("other", "exec-1")).toBeNull();
    });

    it("어느 원장에도 없으면 비운다", async () => {
        expect(await makeUseCase().execute("local", "없음")).toBeNull();
    });
});
