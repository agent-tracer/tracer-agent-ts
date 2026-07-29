import { Controller, Get, Headers, NotFoundException, Param } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { GetGraphJobExecutionUseCase } from "~agent-api/domain/job/application/query/get.graph.job.execution.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";

/** 자기 접수구에서 원장을 직접 쓰는 구현체의 실행 상태를 조회하는 HTTP 계약을 제공한다. */
@Controller("api/v1/jobs/graph")
export class JobGraphQueryController {
    constructor(private readonly getExecution: GetGraphJobExecutionUseCase) {}

    @Get(":id")
    async get(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const execution = await this.getExecution.execute(resolveUserId(user), id);
        if (execution === null) throw new NotFoundException("Graph job execution not found");
        return { execution };
    }
}
