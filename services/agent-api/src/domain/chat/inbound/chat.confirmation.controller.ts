import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { ConfirmToolUseCase } from "~agent-api/domain/chat/application/command/confirm.tool.usecase.js";
import { ProposeToolUseCase } from "~agent-api/domain/chat/application/command/propose.tool.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    confirmToolSchema,
    proposeToolSchema,
    type ConfirmToolPayload,
    type ProposeToolPayload,
} from "./chat.schema.js";

/** 쓰기 도구를 대기 행으로 세우고 사용자의 승인이나 거절로 해소하는 HTTP 계약을 제공한다. */
@Controller("api/v1/chat/threads")
export class ChatConfirmationController {
    constructor(
        private readonly proposeTool: ProposeToolUseCase,
        private readonly confirmTool: ConfirmToolUseCase,
    ) {}

    @Post(":threadId/confirmations")
    @HttpCode(HttpStatus.CREATED)
    async propose(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Body(new SchemaValidationPipe(proposeToolSchema)) body: ProposeToolPayload,
    ) {
        return this.proposeTool.execute({
            userId: resolveUserId(user),
            threadId,
            toolName: body.toolName,
            args: body.args,
        });
    }

    @Post(":threadId/confirmations/:confirmationId")
    @HttpCode(HttpStatus.OK)
    async confirm(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("confirmationId", pathParamPipe) confirmationId: string,
        @Body(new SchemaValidationPipe(confirmToolSchema)) body: ConfirmToolPayload,
    ) {
        return this.confirmTool.execute({
            userId: resolveUserId(user),
            threadId,
            confirmationId,
            decision: body.decision,
        });
    }
}
