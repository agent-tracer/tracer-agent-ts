import { Inject, Injectable } from "@nestjs/common";
import { JOB_REPOSITORY, type JobLeaseOutcome, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 리스를 쥔 실행기가 산출물이나 실패를 싣고 잡을 종결한다. */
@Injectable()
export class SettleRuleJobUseCase {
    constructor(@Inject(JOB_REPOSITORY) private readonly jobs: JobRepositoryPort) {}

    async execute(
        userId: string,
        id: string,
        owner: string,
        outcome: JobLeaseOutcome,
        now: Date,
    ): Promise<"settled" | "lease-lost" | "not-found"> {
        const job = await this.jobs.findById(id);
        if (job === null || !job.isOwnedBy(userId)) return "not-found";
        const settled = await this.jobs.settleWithLease(id, owner, outcome, now);
        return settled ? "settled" : "lease-lost";
    }
}
