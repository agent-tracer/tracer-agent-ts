import { Inject, Injectable } from "@nestjs/common";
import { AGENT_ID_BY_JOB_KIND } from "~agent-api/domain/job/model/graph.job.execution.model.js";
import type { JobKind } from "~agent-api/domain/job/model/job.const.js";
import { mapGraphJobExecutionToJobDto } from "~agent-api/domain/job/model/graph.job.execution.view.model.js";
import { mapJob, type JobDto } from "~agent-api/domain/job/model/job.view.model.js";
import {
    GRAPH_JOB_EXECUTION_READER,
    type GraphJobExecutionReaderPort,
} from "~agent-api/domain/job/port/graph.job.execution.reader.port.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

/** 사용자와 종류와 태스크 조합의 최신 잡을 두 원장을 함께 봐서 조회한다. */
@Injectable()
export class GetLatestJobUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
        @Inject(GRAPH_JOB_EXECUTION_READER)
        private readonly graphExecutions: GraphJobExecutionReaderPort,
    ) {}

    async execute(userId: string, kind: JobKind, taskId?: string): Promise<{ readonly job: JobDto | null }> {
        const agentId = AGENT_ID_BY_JOB_KIND[kind];
        const [job, row] = await Promise.all([
            this.jobs.findLatest(userId, kind, taskId),
            agentId !== undefined ? this.graphExecutions.findLatest(userId, agentId, taskId) : Promise.resolve(null),
        ]);
        return { job: pickNewer(job !== null ? mapJob(job) : null, row !== null ? mapGraphJobExecutionToJobDto(row) : null) };
    }
}

function pickNewer(left: JobDto | null, right: JobDto | null): JobDto | null {
    if (left === null) return right;
    if (right === null) return left;
    return left.createdAt >= right.createdAt ? left : right;
}
