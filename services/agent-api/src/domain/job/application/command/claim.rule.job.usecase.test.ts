import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { ClaimRuleJobUseCase } from "./claim.rule.job.usecase.js";

const NOW = new Date("2026-08-02T00:00:00.000Z");

function harness(): { useCase: ClaimRuleJobUseCase; jobs: InMemoryJobRepository } {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.ruleGeneration, { taskId: "task-1" }, NOW));
    return { useCase: new ClaimRuleJobUseCase(jobs), jobs };
}

describe("ClaimRuleJobUseCase", () => {
    it("비어 있는 잡을 부른 실행기의 리스로 가져간다", async () => {
        const { useCase } = harness();

        const lease = await useCase.execute("local", "job-1", "runner-1", NOW);

        expect(lease).toEqual({
            held: true,
            leaseOwner: "runner-1",
            leaseExpiresAt: expect.any(String),
        });
    });

    it("남이 쥔 살아 있는 리스는 가져가지 못한다", async () => {
        const { useCase } = harness();
        await useCase.execute("local", "job-1", "runner-1", NOW);

        const lease = await useCase.execute("local", "job-1", "runner-2", NOW);

        expect(lease?.held).toBe(false);
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        const { useCase } = harness();

        expect(await useCase.execute("other", "job-1", "runner-1", NOW)).toBeNull();
    });
});
