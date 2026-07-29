import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { RegisterAndResolvePromptFragmentsUseCase } from "~agent-api/domain/evaluation/application/command/register.and.resolve.prompt.fragments.usecase.js";
import { RegisterPythonPromptUseCase } from "~agent-api/domain/evaluation/application/command/register.python.prompt.usecase.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    registerAndResolvePromptFragmentsSchema, registerPythonPromptSchema,
    type RegisterAndResolvePromptFragmentsPayload, type RegisterPythonPromptPayload,
} from "./prompt.schema.js";

/** 배포 단위 사이에서만 오가는 창구라 게이트웨이가 바깥에 열지 않으며, 브라우저는 이 경로를 알지 못한다. */
@Controller("internal/prompts")
export class PromptInternalController {
    constructor(private readonly registerAndResolve: RegisterAndResolvePromptFragmentsUseCase,
        private readonly registerPython: RegisterPythonPromptUseCase) {}

    @Post("fragments/register-and-resolve")
    @HttpCode(HttpStatus.OK)
    fragments(@Body(new SchemaValidationPipe(registerAndResolvePromptFragmentsSchema)) body: RegisterAndResolvePromptFragmentsPayload) {
        return this.registerAndResolve.execute(body);
    }

    @Post("python/register")
    register(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(registerPythonPromptSchema)) body: RegisterPythonPromptPayload) {
        return this.registerPython.execute({ userId: resolveUserId(user), ...body });
    }
}
