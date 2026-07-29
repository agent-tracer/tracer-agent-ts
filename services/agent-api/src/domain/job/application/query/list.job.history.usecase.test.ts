import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { graphJobExecution } from "~agent-api/domain/job/port/__fakes__/graph.job.execution.fixture.js";
import { InMemoryGraphJobExecutionReader } from "~agent-api/domain/job/port/__fakes__/in-memory.graph.job.execution.reader.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { ListJobHistoryUseCase } from "./list.job.history.usecase.js";

function at(day: number): Date {
    return new Date(`2026-01-0${day}T00:00:00.000Z`);
}

function makeUseCase(): ListJobHistoryUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(
        Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, at(1)),
        Job.create("job-3", "local", JOB_KIND.taskCleanup, {}, at(3)),
    );
    const executions = new InMemoryGraphJobExecutionReader();
    executions.seed(
        graphJobExecution({ id: "exec-2", userId: "local", kind: "recipe-scan", status: "queued", createdAt: at(2) }),
        graphJobExecution({ id: "exec-4", userId: "local", kind: "recipe-scan", status: "completed", createdAt: at(4) }),
    );
    return new ListJobHistoryUseCase(jobs, executions);
}

describe("ListJobHistoryUseCase", () => {
    it("두 원장을 시각순으로 합쳐 준다", async () => {
        const page = await makeUseCase().execute("local", { limit: 10, offset: 0 });

        expect(page.items.map((item) => item.id)).toEqual(["exec-4", "job-3", "exec-2", "job-1"]);
        expect(page.total).toBe(4);
    });

    it("합친 목록을 건너뛰고 자른다", async () => {
        const page = await makeUseCase().execute("local", { limit: 2, offset: 1 });

        expect(page.items.map((item) => item.id)).toEqual(["job-3", "exec-2"]);
    });

    it("종류를 고르면 두 원장에서 그 종류만 본다", async () => {
        const page = await makeUseCase().execute("local", { kind: JOB_KIND.recipeScan, limit: 10, offset: 0 });

        expect(page.items.map((item) => item.id)).toEqual(["exec-4", "exec-2", "job-1"]);
    });

    it("실행 원장에 대응이 없는 종류는 잡 원장만 본다", async () => {
        const page = await makeUseCase().execute("local", { kind: JOB_KIND.ruleGeneration, limit: 10, offset: 0 });

        expect(page.items).toEqual([]);
    });

    it("상태로 거를 때 두 원장의 어휘를 맞춘다", async () => {
        const page = await makeUseCase().execute("local", { status: "pending", limit: 10, offset: 0 });

        expect(page.items.map((item) => item.id)).toEqual(["job-3", "exec-2", "job-1"]);
    });
});
