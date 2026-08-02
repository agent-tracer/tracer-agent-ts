import { describe, expect, it } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { JOB_LEASE_TTL_MS } from "~agent-api/domain/job/model/job.lease.model.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { ClaimRuleJobUseCase } from "./claim.rule.job.usecase.js";
import { RenewRuleJobLeaseUseCase } from "./renew.rule.job.lease.usecase.js";

const NOW = new Date("2026-08-02T00:00:00.000Z");

function harness() {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.ruleGeneration, { taskId: "task-1" }, NOW));
    return { claim: new ClaimRuleJobUseCase(jobs), renew: new RenewRuleJobLeaseUseCase(jobs) };
}

describe("RenewRuleJobLeaseUseCase", () => {
    it("쥐고 있는 실행기의 리스 수명을 늘린다", async () => {
        const { claim, renew } = harness();
        const claimed = await claim.execute("local", "job-1", "runner-1", NOW);
        const later = new Date(NOW.getTime() + 1_000);

        const lease = await renew.execute("local", "job-1", "runner-1", later);

        expect(lease?.held).toBe(true);
        expect(Date.parse(lease?.leaseExpiresAt ?? "")).toBeGreaterThan(
            Date.parse(claimed?.leaseExpiresAt ?? ""),
        );
    });

    it("리스가 만료된 뒤에는 늘리지 못한다", async () => {
        const { claim, renew } = harness();
        await claim.execute("local", "job-1", "runner-1", NOW);

        const lease = await renew.execute(
            "local",
            "job-1",
            "runner-1",
            new Date(NOW.getTime() + JOB_LEASE_TTL_MS + 1),
        );

        expect(lease?.held).toBe(false);
    });

    it("쥐지 않은 실행기는 늘리지 못한다", async () => {
        const { claim, renew } = harness();
        await claim.execute("local", "job-1", "runner-1", NOW);

        expect((await renew.execute("local", "job-1", "runner-2", NOW))?.held).toBe(false);
    });
});
