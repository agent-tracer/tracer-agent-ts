import { Inject, Injectable } from "@nestjs/common";
import type { JobSettlement } from "~agent-api/domain/job/model/job.settlement.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 리스를 쥔 실행기가 산출물이나 실패를 싣고 잡을 종결한다. */
@Injectable()
export class SettleRuleJobUseCase {
    constructor(@Inject(JOB_REPOSITORY) private readonly jobs: JobRepositoryPort) {}

    async execute(
        userId: string,
        id: string,
        owner: string,
        outcome: JobSettlement,
        now: Date,
    ): Promise<"settled" | "lease-lost" | "not-found"> {
        const job = await this.jobs.findById(id);
        if (job === null || !job.isOwnedBy(userId)) return "not-found";
        const settled = await this.jobs.settleWithLease(id, owner, outcome, now);
        return settled ? "settled" : "lease-lost";
    }
}
