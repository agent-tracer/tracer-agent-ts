import { Inject, Injectable } from "@nestjs/common";
import { mapJob, type JobDto } from "~agent-api/domain/job/model/job.view.model.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 잡 상세를 소유자에게만 조회해 준다. */
@Injectable()
export class GetJobUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
    ) {}

    async execute(userId: string, id: string): Promise<JobDto | null> {
        const job = await this.jobs.findById(id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(userId)) return null;
        return mapJob(job);
    }
}
