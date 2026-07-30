import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { RegisterAndResolvePromptFragmentsUseCase } from "~agent-api/domain/evaluation/application/command/register.and.resolve.prompt.fragments.usecase.js";
import { RegisterBackendPromptUseCase } from "~agent-api/domain/evaluation/application/command/register.backend.prompt.usecase.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    backendNameSchema, registerAndResolvePromptFragmentsSchema, registerBackendPromptSchema,
    type RegisterAndResolvePromptFragmentsPayload, type RegisterBackendPromptPayload,
} from "./prompt.schema.js";

/** 배포 단위 사이에서만 오가는 창구라 게이트웨이가 바깥에 열지 않으며, 브라우저는 이 경로를 알지 못한다. */
@Controller("internal/prompts")
export class PromptInternalController {
    constructor(private readonly registerAndResolve: RegisterAndResolvePromptFragmentsUseCase,
        private readonly registerBackend: RegisterBackendPromptUseCase) {}

    @Post("fragments/register-and-resolve")
    @HttpCode(HttpStatus.OK)
    fragments(@Body(new SchemaValidationPipe(registerAndResolvePromptFragmentsSchema)) body: RegisterAndResolvePromptFragmentsPayload) {
        return this.registerAndResolve.execute(body);
    }

    @Post(":backend/register")
    register(@Param("backend", new SchemaValidationPipe(backendNameSchema)) backend: string,
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(registerBackendPromptSchema)) body: RegisterBackendPromptPayload) {
        return this.registerBackend.execute({ userId: resolveUserId(user), backend, ...body });
    }
}
