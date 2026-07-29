import { Inject, Injectable } from "@nestjs/common";
import { AGENT_ID_BY_JOB_KIND, toGraphStatus } from "~agent-api/domain/job/model/graph.job.execution.model.js";
import type { JobKind, JobStatus } from "~agent-api/domain/job/model/job.const.js";
import { mapGraphJobExecutionToJobDto } from "~agent-api/domain/job/model/graph.job.execution.view.model.js";
import { mapJob, type JobDto, type JobListDto } from "~agent-api/domain/job/model/job.view.model.js";
import {
    GRAPH_JOB_EXECUTION_READER,
    type GraphJobExecutionReaderPort,
} from "~agent-api/domain/job/port/graph.job.execution.reader.port.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";

export interface ListJobHistoryOptions {
    readonly kind?: JobKind;
    readonly status?: JobStatus;
    readonly limit: number;
    readonly offset: number;
}

/** 사용자의 잡 이력을 두 원장에서 시각순으로 합쳐 조회한다. */
@Injectable()
export class ListJobHistoryUseCase {
    constructor(
        @Inject(JOB_REPOSITORY)
        private readonly jobs: JobRepositoryPort,
        @Inject(GRAPH_JOB_EXECUTION_READER)
        private readonly graphExecutions: GraphJobExecutionReaderPort,
    ) {}

    async execute(userId: string, options: ListJobHistoryOptions): Promise<JobListDto> {
        // 두 원장을 시각순으로 합쳐 자르므로, 자를 지점까지는 각자 건너뛰지 않고 전부 받아 온다.
        const fetchCount = options.offset + options.limit;
        const agentId = options.kind !== undefined ? AGENT_ID_BY_JOB_KIND[options.kind] : undefined;
        const includeGraph = options.kind === undefined || agentId !== undefined;

        const [page, graphPage] = await Promise.all([
            this.jobs.findHistoryByUser(userId, {
                ...(options.kind !== undefined ? { kind: options.kind } : {}),
                ...(options.status !== undefined ? { status: options.status } : {}),
                limit: fetchCount,
                offset: 0,
            }),
            includeGraph
                ? this.graphExecutions.findHistoryByUser(userId, {
                    ...(agentId !== undefined ? { kind: agentId } : {}),
                    ...(options.status !== undefined ? { status: toGraphStatus(options.status) } : {}),
                    limit: fetchCount,
                    offset: 0,
                })
                : Promise.resolve({ items: [], total: 0 }),
        ]);

        const merged: JobDto[] = [
            ...page.items.map(mapJob),
            ...graphPage.items.flatMap((row) => {
                const dto = mapGraphJobExecutionToJobDto(row);
                return dto !== null ? [dto] : [];
            }),
        ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

        return {
            items: merged.slice(options.offset, options.offset + options.limit),
            total: page.total + graphPage.total,
        };
    }
}
