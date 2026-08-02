import { describe, expect, it } from "vitest";
import { JOB_KIND, JOB_STATUS } from "~agent-api/domain/job/model/job.const.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { InMemoryJobRepository } from "~agent-api/domain/job/port/__fakes__/in-memory.job.repository.js";
import { ClaimRuleJobUseCase } from "./claim.rule.job.usecase.js";
import { SettleRuleJobUseCase } from "./settle.rule.job.usecase.js";

const NOW = new Date("2026-08-02T00:00:00.000Z");
const DONE = { status: JOB_STATUS.completed, result: { rules: [] } };

function harness() {
    const jobs = new InMemoryJobRepository();
    jobs.seed(Job.create("job-1", "local", JOB_KIND.ruleGeneration, { taskId: "task-1" }, NOW));
    return { claim: new ClaimRuleJobUseCase(jobs), settle: new SettleRuleJobUseCase(jobs) };
}

describe("SettleRuleJobUseCase", () => {
    it("리스를 쥔 실행기가 산출물을 싣고 종결한다", async () => {
        const { claim, settle } = harness();
        await claim.execute("local", "job-1", "runner-1", NOW);

        expect(await settle.execute("local", "job-1", "runner-1", DONE, NOW)).toBe("settled");
    });

    it("리스를 잃은 실행기는 종결하지 못한다", async () => {
        const { claim, settle } = harness();
        await claim.execute("local", "job-1", "runner-1", NOW);

        expect(await settle.execute("local", "job-1", "runner-2", DONE, NOW)).toBe("lease-lost");
    });

    it("남의 잡은 존재 여부도 드러내지 않는다", async () => {
        const { settle } = harness();

        expect(await settle.execute("other", "job-1", "runner-1", DONE, NOW)).toBe("not-found");
    });
});
