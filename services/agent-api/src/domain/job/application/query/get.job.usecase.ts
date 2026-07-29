import { Inject, Injectable } from "@nestjs/common";
import { mapGraphJobExecutionToJobDto } from "~agent-api/domain/job/model/graph.job.execution.view.model.js";
import { mapJob, type JobDto } from "~agent-api/domain/job/model/job.view.model.js";
import {
    GRAPH_JOB_EXECUTION_READER,
    type GraphJobExecutionReaderPort,
} from "~agent-api/domain/job/port/graph.job.execution.reader.port.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 잡 상세를 소유자에게만, 두 원장을 함께 봐서 조회해 준다. */
@Injectable()
export class GetJobUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
        @Inject(GRAPH_JOB_EXECUTION_READER)
        private readonly graphExecutions: GraphJobExecutionReaderPort,
    ) {}

    async execute(userId: string, id: string): Promise<JobDto | null> {
        const job = await this.jobs.findById(id);
        if (job !== null) return job.isOwnedBy(userId) ? mapJob(job) : null;

        const row = await this.graphExecutions.findById(id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (row === null || !row.isOwnedBy(userId)) return null;
        return mapGraphJobExecutionToJobDto(row);
    }
}
