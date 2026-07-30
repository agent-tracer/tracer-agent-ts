import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { ListJobHistoryUseCase } from "./list.job.history.usecase.js";

function at(day: number): Date {
    return new Date(`2026-01-0${day}T00:00:00.000Z`);
}

function makeUseCase(): ListJobHistoryUseCase {
    const jobs = new InMemoryJobRepository();
    jobs.seed(
        Job.create("job-1", "local", JOB_KIND.recipeScan, { taskId: "task-1" }, at(1)),
        Job.create("job-2", "local", JOB_KIND.recipeScan, { taskId: "task-2" }, at(2)),
        Job.create("job-3", "local", JOB_KIND.taskCleanup, {}, at(3)),
    );
    return new ListJobHistoryUseCase(jobs);
}

describe("ListJobHistoryUseCase", () => {
    it("이력을 시각 역순으로 준다", async () => {
        const page = await makeUseCase().execute("local", { limit: 10, offset: 0 });

        expect(page.items.map((item) => item.id)).toEqual(["job-3", "job-2", "job-1"]);
        expect(page.total).toBe(3);
    });

    it("건너뛰고 자른 뒤에도 전체 수를 함께 준다", async () => {
        const page = await makeUseCase().execute("local", { limit: 1, offset: 1 });

        expect(page.items.map((item) => item.id)).toEqual(["job-2"]);
        expect(page.total).toBe(3);
    });

    it("종류를 고르면 그 종류만 준다", async () => {
        const page = await makeUseCase().execute("local", { kind: JOB_KIND.recipeScan, limit: 10, offset: 0 });

        expect(page.items.map((item) => item.id)).toEqual(["job-2", "job-1"]);
    });

    it("상태로 거른다", async () => {
        const page = await makeUseCase().execute("local", { status: "completed", limit: 10, offset: 0 });

        expect(page.items).toEqual([]);
    });

    it("남의 이력은 드러내지 않는다", async () => {
        const page = await makeUseCase().execute("other", { limit: 10, offset: 0 });

        expect(page.items).toEqual([]);
        expect(page.total).toBe(0);
    });
});
