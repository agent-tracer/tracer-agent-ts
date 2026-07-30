import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { CreatePromptUseCase } from "~agent-api/domain/evaluation/application/command/create.prompt.usecase.js";
import { CreatePromptVersionUseCase } from "~agent-api/domain/evaluation/application/command/create.prompt.version.usecase.js";
import { PromotePromptUseCase } from "~agent-api/domain/evaluation/application/command/promote.prompt.usecase.js";
import { RollbackPromptChannelUseCase } from "~agent-api/domain/evaluation/application/command/rollback.prompt.channel.usecase.js";
import { GetPromptChannelsUseCase } from "~agent-api/domain/evaluation/application/query/get.prompt.channels.usecase.js";
import { ListPromptVersionsUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.versions.usecase.js";
import { ListPromptsUseCase } from "~agent-api/domain/evaluation/application/query/list.prompts.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    createPromptSchema, createPromptVersionSchema, promotePromptSchema, rollbackPromptChannelSchema,
    type CreatePromptPayload, type CreatePromptVersionPayload, type PromotePromptPayload,
    type RollbackPromptChannelPayload,
} from "./prompt.schema.js";

@Controller("api/agent/evaluation/prompts")
export class PromptController {
    constructor(private readonly createPrompt: CreatePromptUseCase, private readonly createVersion: CreatePromptVersionUseCase,
        private readonly listPrompts: ListPromptsUseCase, private readonly listVersions: ListPromptVersionsUseCase,
        private readonly channels: GetPromptChannelsUseCase, private readonly promote: PromotePromptUseCase,
        private readonly rollback: RollbackPromptChannelUseCase) {}
    @Get() list(@Headers(MONITOR_USER_HEADER) user: string | undefined) { return this.listPrompts.execute(resolveUserId(user)); }
    @Post() create(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createPromptSchema)) body: CreatePromptPayload) {
        return this.createPrompt.execute({ userId: resolveUserId(user), ...body });
    }
    @Get(":id/versions") versions(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string) { return this.listVersions.execute(resolveUserId(user), id); }
    @Post(":id/versions") addVersion(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(createPromptVersionSchema)) body: CreatePromptVersionPayload) {
        return this.createVersion.execute({ userId: resolveUserId(user), definitionId: id, version: body });
    }
    @Get(":id/channels") getChannels(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string) { return this.channels.execute(resolveUserId(user), id); }
    @Post(":id/promotions") promoteVersion(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string, @Body(new SchemaValidationPipe(promotePromptSchema)) body: PromotePromptPayload) {
        return this.promote.execute({ userId: resolveUserId(user), definitionId: id, ...body });
    }
    @Post(":id/rollback") rollbackChannel(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(rollbackPromptChannelSchema)) body: RollbackPromptChannelPayload) {
        return this.rollback.execute({ userId: resolveUserId(user), definitionId: id, ...body });
    }
}
