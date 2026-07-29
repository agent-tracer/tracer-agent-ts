import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Put } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { RememberFactUseCase } from "~agent-api/domain/chat/application/command/remember.fact.usecase.js";
import { RecallFactsUseCase } from "~agent-api/domain/chat/application/query/recall.facts.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { rememberFactBodySchema, type RememberFactBody } from "./chat.memory.schema.js";

/** 사용자 장기기억의 HTTP 계약을 제공하며 recall_facts와 remember_fact 도구가 이 자리를 본다. */
@Controller("api/v1/chat/memories")
export class ChatMemoryController {
    constructor(
        private readonly recallFacts: RecallFactsUseCase,
        private readonly rememberFact: RememberFactUseCase,
    ) {}

    @Get()
    async list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.recallFacts.execute(resolveUserId(user));
    }

    @Put(":key")
    @HttpCode(HttpStatus.OK)
    async remember(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("key", pathParamPipe) key: string,
        @Body(new SchemaValidationPipe(rememberFactBodySchema)) body: RememberFactBody,
    ) {
        return this.rememberFact.execute({ userId: resolveUserId(user), key, content: body.content });
    }
}
