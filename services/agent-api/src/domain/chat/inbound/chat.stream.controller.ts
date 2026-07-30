import { Controller, Get, Headers, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { ListChatExecutionsUseCase } from "~agent-api/domain/chat/application/query/list.chat.executions.usecase.js";
import { WatchChatExecutionUseCase } from "~agent-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { streamChatExecution } from "./chat.execution.stream.js";

/** 실행 이력 조회와 연결이 살아 있는 동안 이어지는 스냅샷 스트림의 HTTP 계약을 제공한다. */
@Controller("api/agent/chat/threads")
export class ChatStreamController {
    constructor(
        private readonly listChatExecutions: ListChatExecutionsUseCase,
        private readonly watchChatExecution: WatchChatExecutionUseCase,
    ) {}

    @Get(":threadId/executions")
    async executions(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.listChatExecutions.execute(resolveUserId(user), threadId);
    }

    @Get(":threadId/executions/:executionId/events")
    async executionEventStream(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("executionId", pathParamPipe) executionId: string,
        @Res() response: Response,
    ): Promise<void> {
        await streamChatExecution(this.watchChatExecution, response, {
            userId: resolveUserId(user),
            threadId,
            executionId,
        });
    }
}
