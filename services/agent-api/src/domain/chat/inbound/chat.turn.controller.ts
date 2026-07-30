import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { CancelChatExecutionUseCase } from "~agent-api/domain/chat/application/command/cancel.chat.execution.usecase.js";
import { EnqueueChatTurnUseCase } from "~agent-api/domain/chat/application/command/enqueue.chat.turn.usecase.js";
import { GetChatExecutionStepsUseCase } from "~agent-api/domain/chat/application/query/get.chat.execution.steps.usecase.js";
import { GetChatReplayUseCase } from "~agent-api/domain/chat/application/query/get.chat.replay.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { postMessageSchema, type PostMessagePayload } from "./chat.schema.js";

/** 연결보다 오래 사는 대화 턴의 접수와 중단과 되읽기의 HTTP 계약을 제공한다. */
@Controller("api/agent/chat/threads")
export class ChatTurnController {
    constructor(
        private readonly enqueueChatTurn: EnqueueChatTurnUseCase,
        private readonly cancelChatExecution: CancelChatExecutionUseCase,
        private readonly getExecutionSteps: GetChatExecutionStepsUseCase,
        private readonly getChatReplay: GetChatReplayUseCase,
    ) {}

    @Post(":threadId/messages")
    @HttpCode(HttpStatus.ACCEPTED)
    async send(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Body(new SchemaValidationPipe(postMessageSchema)) body: PostMessagePayload,
    ) {
        return this.enqueueChatTurn.execute({
            userId: resolveUserId(user),
            threadId,
            clientRequestId: body.clientRequestId,
            content: body.content,
            ...(body.model !== undefined ? { model: body.model } : {}),
            ...(body.language !== undefined ? { language: body.language } : {}),
        });
    }

    @Post(":threadId/executions/:executionId/cancel")
    async cancelExecution(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("executionId", pathParamPipe) executionId: string,
    ) {
        return this.cancelChatExecution.execute(resolveUserId(user), threadId, executionId);
    }

    @Get(":threadId/executions/:executionId/steps")
    async executionSteps(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("executionId", pathParamPipe) executionId: string,
    ) {
        return this.getExecutionSteps.execute(resolveUserId(user), threadId, executionId);
    }

    /** 실행기가 이번 턴에 모델에게 되돌려 줄 이력을 되읽는 자리이며, 자격은 실행 범위 토큰이 정한다. */
    @Get(":threadId/executions/:executionId/replay")
    async executionReplay(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("executionId", pathParamPipe) executionId: string,
    ) {
        return this.getChatReplay.execute(resolveUserId(user), threadId, executionId);
    }
}
