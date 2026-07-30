import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { CreateThreadUseCase } from "~agent-api/domain/chat/application/command/create.thread.usecase.js";
import { DeleteThreadUseCase } from "~agent-api/domain/chat/application/command/delete.thread.usecase.js";
import { RenameThreadUseCase } from "~agent-api/domain/chat/application/command/rename.thread.usecase.js";
import { GetMessagesUseCase } from "~agent-api/domain/chat/application/query/get.messages.usecase.js";
import { GetThreadUseCase } from "~agent-api/domain/chat/application/query/get.thread.usecase.js";
import { ListThreadsUseCase } from "~agent-api/domain/chat/application/query/list.threads.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    createThreadSchema,
    renameThreadSchema,
    type CreateThreadPayload,
    type RenameThreadPayload,
} from "./chat.schema.js";

/** 대화 스레드와 그 메시지의 HTTP 계약을 제공한다. */
@Controller("api/agent/chat/threads")
export class ChatThreadController {
    constructor(
        private readonly listThreads: ListThreadsUseCase,
        private readonly getThread: GetThreadUseCase,
        private readonly getMessages: GetMessagesUseCase,
        private readonly createThread: CreateThreadUseCase,
        private readonly renameThread: RenameThreadUseCase,
        private readonly deleteThread: DeleteThreadUseCase,
    ) {}

    @Get()
    async list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.listThreads.execute(resolveUserId(user));
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createThreadSchema)) body: CreateThreadPayload,
    ) {
        return this.createThread.execute({ userId: resolveUserId(user), title: body.title });
    }

    @Get(":threadId")
    async detail(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.getThread.execute(resolveUserId(user), threadId);
    }

    @Get(":threadId/messages")
    async messages(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.getMessages.execute(resolveUserId(user), threadId);
    }

    @Patch(":threadId")
    async rename(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Body(new SchemaValidationPipe(renameThreadSchema)) body: RenameThreadPayload,
    ) {
        return this.renameThread.execute({ userId: resolveUserId(user), threadId, title: body.title });
    }

    @Delete(":threadId")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.deleteThread.execute(resolveUserId(user), threadId);
    }
}
