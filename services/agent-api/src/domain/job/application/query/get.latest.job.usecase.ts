import { Inject, Injectable } from "@nestjs/common";
import type { JobKind } from "~agent-api/domain/job/model/job.const.js";
import { mapJob, type JobDto } from "~agent-api/domain/job/model/job.view.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 사용자와 종류와 태스크 조합의 최신 잡을 조회한다. */
@Injectable()
export class GetLatestJobUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
    ) {}

    async execute(userId: string, kind: JobKind, taskId?: string): Promise<{ readonly job: JobDto | null }> {
        const job = await this.jobs.findLatest(userId, kind, taskId);
        return { job: job !== null ? mapJob(job) : null };
    }
}
