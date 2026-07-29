import { Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { IssueChatExecutionEnvelopeUseCase } from "~agent-api/domain/chat/application/command/issue.chat.execution.envelope.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";

/** 배포 단위 사이에서만 오가는 창구라 게이트웨이가 바깥에 열지 않으며, 브라우저는 이 경로를 알지 못한다. */
@Controller("internal/chat/executions")
export class ChatInternalController {
    constructor(private readonly issueEnvelope: IssueChatExecutionEnvelopeUseCase) {}

    @Post(":executionId/envelope")
    @HttpCode(HttpStatus.OK)
    async envelope(@Param("executionId", pathParamPipe) executionId: string) {
        return this.issueEnvelope.execute(executionId);
    }
}
