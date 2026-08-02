import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { ClaimRuleJobUseCase } from "./claim.rule.job.usecase.js";
import { ReleaseRuleJobUseCase } from "./release.rule.job.usecase.js";

const NOW = new Date("2026-08-02T00:00:00.000Z");

function harness() {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.ruleGeneration, { taskId: "task-1" }, NOW));
    return { claim: new ClaimRuleJobUseCase(jobs), release: new ReleaseRuleJobUseCase(jobs) };
}

describe("ReleaseRuleJobUseCase", () => {
    it("쥔 실행기가 리스를 놓으면 다른 실행기가 곧바로 가져간다", async () => {
        const { claim, release } = harness();
        await claim.execute("local", "job-1", "runner-1", NOW);

        expect(await release.execute("local", "job-1", "runner-1", NOW)).toBe(true);
        expect((await claim.execute("local", "job-1", "runner-2", NOW))?.held).toBe(true);
    });

    it("쥐지 않은 실행기는 놓지 못한다", async () => {
        const { claim, release } = harness();
        await claim.execute("local", "job-1", "runner-1", NOW);

        expect(await release.execute("local", "job-1", "runner-2", NOW)).toBe(false);
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        const { release } = harness();

        expect(await release.execute("other", "job-1", "runner-1", NOW)).toBeNull();
    });
});
