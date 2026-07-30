import { Inject, Injectable } from "@nestjs/common";
import type { JobKind, JobStatus } from "~agent-api/domain/job/model/job.const.js";
import { mapJob, type JobListDto } from "~agent-api/domain/job/model/job.view.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

export interface ListJobHistoryOptions {
    readonly kind?: JobKind;
    readonly status?: JobStatus;
    readonly limit: number;
    readonly offset: number;
}

/** 사용자의 잡 이력을 시각순으로 조회한다. */
@Injectable()
export class ListJobHistoryUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
    ) {}

    async execute(userId: string, options: ListJobHistoryOptions): Promise<JobListDto> {
        const page = await this.jobs.findHistoryByUser(userId, {
            ...(options.kind !== undefined ? { kind: options.kind } : {}),
            ...(options.status !== undefined ? { status: options.status } : {}),
            limit: options.limit,
            offset: options.offset,
        });
        return { items: page.items.map(mapJob), total: page.total };
    }
}
