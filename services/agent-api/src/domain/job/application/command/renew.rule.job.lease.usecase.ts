import { Inject, Injectable } from "@nestjs/common";
import { leaseExpiryFrom, leaseOf, type JobLease } from "~agent-api/domain/job/model/job.lease.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 실행이 길어지는 동안 쥔 리스의 수명을 늘린다. */
@Injectable()
export class RenewRuleJobLeaseUseCase {
    constructor(@Inject(JOB_REPOSITORY) private readonly jobs: JobRepositoryPort) {}

    async execute(userId: string, id: string, owner: string, now: Date): Promise<JobLease | null> {
        const job = await this.jobs.findById(id);
        if (job === null || !job.isOwnedBy(userId)) return null;
        const expiresAt = leaseExpiryFrom(now);
        if (!(await this.jobs.renewLease(id, owner, expiresAt, now))) {
            return leaseOf(job.leaseOwner, job.leaseExpiresAt, owner, now);
        }
        return leaseOf(owner, expiresAt, owner, now);
    }
}
