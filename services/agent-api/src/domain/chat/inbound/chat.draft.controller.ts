import { Body, Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CheckpointChatDraftUseCase } from "~agent-api/domain/chat/application/command/checkpoint.chat.draft.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { SkipGate } from "~agent-api/support/skip-gate.decorator.js";
import { checkpointDraftSchema, type CheckpointDraftPayload } from "./chat.schema.js";

/** 실행기의 draft 통지를 받는 창구이며, 자격은 실행 시도에 묶인 토큰 하나뿐이다. */
@SkipGate()
@Controller("api/v1/chat/executions")
export class ChatDraftController {
    constructor(private readonly checkpointDraft: CheckpointChatDraftUseCase) {}

    @Post(":executionId/drafts")
    @HttpCode(HttpStatus.OK)
    async checkpoint(
        @Param("executionId", pathParamPipe) executionId: string,
        @Body(new SchemaValidationPipe(checkpointDraftSchema)) body: CheckpointDraftPayload,
    ) {
        return this.checkpointDraft.execute({ executionId, ...body });
    }
}
