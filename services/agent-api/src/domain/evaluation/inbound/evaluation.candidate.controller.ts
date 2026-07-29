import { Controller, Get, Headers, Param } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { BuildChatExecutionExampleCandidateUseCase } from "../application/query/build.chat.execution.example.candidate.usecase.js";
import { BuildExecutionExampleCandidateUseCase } from "../application/query/build.execution.example.candidate.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";

@Controller("api/v1/evaluation")
export class EvaluationCandidateController {
    constructor(
        private readonly buildJobCandidate: BuildExecutionExampleCandidateUseCase,
        private readonly buildChatCandidate: BuildChatExecutionExampleCandidateUseCase,
    ) {}

    @Get("executions/:jobId/candidate")
    job(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("jobId", pathParamPipe) id: string,
    ) {
        return this.buildJobCandidate.execute(resolveUserId(user), id);
    }

    @Get("chat-executions/:executionId/candidate")
    chat(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("executionId", pathParamPipe) id: string,
    ) {
        return this.buildChatCandidate.execute(resolveUserId(user), id);
    }
}
