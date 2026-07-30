import { Body, Controller, Get, Headers, Post, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { RegisterCandidateFragmentVersionUseCase } from "~agent-api/domain/evaluation/application/command/register.candidate.fragment.version.usecase.js";
import { ListPromptFragmentCatalogUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.fragment.catalog.usecase.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { promptFragmentCatalogQuerySchema, registerCandidateFragmentVersionSchema,
    type PromptFragmentCatalogQuery, type RegisterCandidateFragmentVersionPayload } from "./prompt.schema.js";

@Controller("api/agent/evaluation/prompt-fragments")
export class PromptFragmentController {
    constructor(private readonly catalog: ListPromptFragmentCatalogUseCase,
        private readonly registerCandidate: RegisterCandidateFragmentVersionUseCase) {}
    @Get()
    list(@Query(new SchemaValidationPipe(promptFragmentCatalogQuerySchema)) query: PromptFragmentCatalogQuery) {
        return this.catalog.execute(query);
    }
    @Post("candidate")
    register(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(registerCandidateFragmentVersionSchema)) body: RegisterCandidateFragmentVersionPayload) {
        return this.registerCandidate.execute({ ...body, createdBy: resolveUserId(user) });
    }
}
