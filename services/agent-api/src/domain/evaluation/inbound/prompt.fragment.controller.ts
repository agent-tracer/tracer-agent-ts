import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { PromotePromptFragmentUseCase } from "~agent-api/domain/evaluation/application/command/promote.prompt.fragment.usecase.js";
import { RegisterCandidateFragmentVersionUseCase } from "~agent-api/domain/evaluation/application/command/register.candidate.fragment.version.usecase.js";
import { ListPromptFragmentCatalogUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.fragment.catalog.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { promotePromptFragmentSchema, promptFragmentCatalogQuerySchema, registerCandidateFragmentVersionSchema,
    type PromotePromptFragmentPayload, type PromptFragmentCatalogQuery,
    type RegisterCandidateFragmentVersionPayload } from "./prompt.schema.js";

@Controller("api/agent/evaluation/prompt-fragments")
export class PromptFragmentController {
    constructor(private readonly catalog: ListPromptFragmentCatalogUseCase,
        private readonly registerCandidate: RegisterCandidateFragmentVersionUseCase,
        private readonly promote: PromotePromptFragmentUseCase) {}
    @Get()
    list(@Query(new SchemaValidationPipe(promptFragmentCatalogQuerySchema)) query: PromptFragmentCatalogQuery) {
        return this.catalog.execute(query);
    }
    @Post("candidate")
    register(@Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(registerCandidateFragmentVersionSchema)) body: RegisterCandidateFragmentVersionPayload) {
        return this.registerCandidate.execute({ ...body, createdBy: resolveUserId(user) });
    }
    @Post(":id/promotions")
    promoteVersion(@Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(promotePromptFragmentSchema)) body: PromotePromptFragmentPayload) {
        return this.promote.execute({ definitionId: id, ...body });
    }
}
