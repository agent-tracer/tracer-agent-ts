import { Body, Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { IssueJobExecutionEnvelopeUseCase } from "~agent-api/domain/job/application/command/issue.job.execution.envelope.usecase.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    jobEnvelopeBodySchema,
    jobEnvelopeKindSchema,
    type JobEnvelopeBody,
    type JobEnvelopeKind,
} from "./job.internal.schema.js";

/** 배포 단위 사이에서만 오가는 창구라 게이트웨이가 바깥에 열지 않으며, 브라우저는 이 경로를 알지 못한다. */
@Controller("internal/jobs")
export class JobInternalController {
    constructor(private readonly issueEnvelope: IssueJobExecutionEnvelopeUseCase) {}

    @Post(":kind/envelope")
    @HttpCode(HttpStatus.OK)
    async envelope(
        @Param("kind", new SchemaValidationPipe(jobEnvelopeKindSchema)) kind: JobEnvelopeKind,
        @Body(new SchemaValidationPipe(jobEnvelopeBodySchema)) body: JobEnvelopeBody,
    ) {
        return this.issueEnvelope.execute(kind, body.userId);
    }
}
