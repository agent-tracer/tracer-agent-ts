import { Inject, Injectable } from "@nestjs/common";
import type { JobKind } from "~agent-api/domain/job/model/job.const.js";
import { mapJob, type JobDto } from "~agent-api/domain/job/model/job.view.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 종류별 대기 잡 중 사용자 소유분만 조회한다. */
@Injectable()
export class ListPendingJobsUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
    ) {}

    async execute(userId: string, kind: JobKind): Promise<{ readonly items: readonly JobDto[] }> {
        const jobs = await this.jobs.findPending(kind);
        return { items: jobs.filter((job) => job.isOwnedBy(userId)).map(mapJob) };
    }
}
