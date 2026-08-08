import { Body, Controller, Headers, HttpCode, HttpStatus, NotFoundException, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { CancelJobUseCase } from "~agent-api/domain/job/application/command/cancel.job.usecase.js";
import { EnqueueJobUseCase } from "~agent-api/domain/job/application/command/enqueue.job.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { enqueueBodySchema, type EnqueueBody } from "./job.command.schema.js";

/** 잡 접수와 취소의 HTTP 계약을 제공한다. */
@Controller("api/agent/jobs")
export class JobCommandController {
    constructor(
        private readonly enqueueJob: EnqueueJobUseCase,
        private readonly cancelJob: CancelJobUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    async enqueue(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(enqueueBodySchema)) body: EnqueueBody,
    ) {
        return this.enqueueJob.execute(
            resolveUserId(user),
            body.kind,
            body.input ?? {},
            body.idempotencyKey !== undefined ? { idempotencyKey: body.idempotencyKey } : {},
        );
    }

    @Post(":id/cancel")
    @HttpCode(HttpStatus.OK)
    async cancel(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const job = await this.cancelJob.execute(resolveUserId(user), id);
        if (job === null) throw new NotFoundException("Job execution not found");
        return { job };
    }
}
