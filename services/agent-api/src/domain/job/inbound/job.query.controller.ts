import { Controller, Get, Headers, NotFoundException, Param, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { GetJobStepsUseCase } from "~agent-api/domain/job/application/query/get.job.steps.usecase.js";
import { GetJobUseCase } from "~agent-api/domain/job/application/query/get.job.usecase.js";
import { GetLatestJobUseCase } from "~agent-api/domain/job/application/query/get.latest.job.usecase.js";
import { ListJobHistoryUseCase } from "~agent-api/domain/job/application/query/list.job.history.usecase.js";
import { ListPendingJobsUseCase } from "~agent-api/domain/job/application/query/list.pending.jobs.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    historyQuerySchema,
    latestQuerySchema,
    listQuerySchema,
    type HistoryQuery,
    type LatestQuery,
    type ListQuery,
} from "./job.query.schema.js";

/** 잡 목록과 상세와 실행 궤적 조회의 HTTP 계약을 제공한다. */
@Controller("api/v1/jobs")
export class JobQueryController {
    constructor(
        private readonly getLatestJob: GetLatestJobUseCase,
        private readonly getJob: GetJobUseCase,
        private readonly listPendingJobs: ListPendingJobsUseCase,
        private readonly listJobHistory: ListJobHistoryUseCase,
        private readonly jobSteps: GetJobStepsUseCase,
    ) {}

    @Get()
    async listPending(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listQuerySchema)) query: ListQuery,
    ) {
        return this.listPendingJobs.execute(resolveUserId(user), query.kind);
    }

    @Get("history")
    async history(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(historyQuerySchema)) query: HistoryQuery,
    ) {
        return this.listJobHistory.execute(resolveUserId(user), {
            ...(query.kind !== undefined ? { kind: query.kind } : {}),
            ...(query.status !== undefined ? { status: query.status } : {}),
            limit: query.limit,
            offset: query.offset,
        });
    }

    @Get("latest")
    async latest(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(latestQuerySchema)) query: LatestQuery,
    ) {
        return this.getLatestJob.execute(resolveUserId(user), query.kind, query.taskId);
    }

    @Get(":id/steps")
    async steps(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const steps = await this.jobSteps.execute(resolveUserId(user), id);
        if (steps === null) throw new NotFoundException("Job not found");
        return steps;
    }

    @Get(":id")
    async get(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const job = await this.getJob.execute(resolveUserId(user), id);
        if (job === null) throw new NotFoundException("Job not found");
        return { job };
    }
}
