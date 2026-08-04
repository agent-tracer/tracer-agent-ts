import { Inject, Injectable } from "@nestjs/common";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 끝내지 못한 실행기가 리스를 놓아 잡을 곧바로 대기로 되돌린다. */
@Injectable()
export class ReleaseRuleJobUseCase {
    constructor(@Inject(JOB_REPOSITORY) private readonly jobs: JobRepositoryPort) {}

    async execute(userId: string, id: string, owner: string, now: Date): Promise<boolean | null> {
        const job = await this.jobs.findById(id);
        if (job === null || !job.isOwnedBy(userId)) return null;
        return this.jobs.releaseLease(id, owner, now);
    }
}
