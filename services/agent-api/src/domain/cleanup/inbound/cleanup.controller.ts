import { Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { AcceptCleanupSuggestionUseCase } from "~agent-api/domain/cleanup/application/command/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "~agent-api/domain/cleanup/application/command/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "~agent-api/domain/cleanup/application/query/list.cleanup.suggestions.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { listQuerySchema, type ListQuery } from "./cleanup.schema.js";

/** 정리 제안의 조회와 해소 창구이며 만드는 자리는 잡의 종결 단계가 갖는다. */
@Controller("api/agent/cleanup/suggestions")
export class CleanupController {
    constructor(
        private readonly listSuggestions: ListCleanupSuggestionsUseCase,
        private readonly acceptSuggestion: AcceptCleanupSuggestionUseCase,
        private readonly dismissSuggestion: DismissCleanupSuggestionUseCase,
    ) {}

    @Get()
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listQuerySchema)) query: ListQuery,
    ) {
        return this.listSuggestions.execute(resolveUserId(user), query.status);
    }

    @Post(":id/accept")
    @HttpCode(HttpStatus.OK)
    async accept(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.acceptSuggestion.execute(resolveUserId(user), id);
    }

    @Post(":id/dismiss")
    @HttpCode(HttpStatus.OK)
    async dismiss(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.dismissSuggestion.execute(resolveUserId(user), id);
    }
}
