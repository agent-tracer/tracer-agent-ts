import { Inject, Injectable } from "@nestjs/common";
import { leaseExpiryFrom, leaseOf, type JobLease } from "~agent-api/domain/job/model/job.lease.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 로컬 실행기가 대기 중인 잡 하나를 자기 리스로 가져간다. */
@Injectable()
export class ClaimRuleJobUseCase {
    constructor(@Inject(JOB_REPOSITORY) private readonly jobs: JobRepositoryPort) {}

    async execute(userId: string, id: string, owner: string, now: Date): Promise<JobLease | null> {
        const job = await this.jobs.findById(id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(userId)) return null;
        const expiresAt = leaseExpiryFrom(now);
        if (!(await this.jobs.claimLease(id, owner, expiresAt, now))) {
            return leaseOf(job.leaseOwner, job.leaseExpiresAt, owner, now);
        }
        return leaseOf(owner, expiresAt, owner, now);
    }
}
