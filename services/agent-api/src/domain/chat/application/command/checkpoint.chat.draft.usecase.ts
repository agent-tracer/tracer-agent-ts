import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CHAT_DRAFT_TOKEN, type ChatDraftTokenPort } from "~agent-api/domain/chat/port/chat.draft.token.port.js";
import {
    CHAT_EXECUTION_UPDATE_PUBLISHER,
    type ChatExecutionUpdatePublisherPort,
} from "~agent-api/domain/chat/port/chat.execution.update.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    type ChatExecutionRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

export interface ChatDraftCheckpointInput {
    readonly executionId: string;
    readonly token: string;
    readonly attempt: number;
    readonly draftSeq: number;
    readonly text: string;
}

/** 실행기가 프로세스 밖에서 보낸 누적 draft를 정본에 반영하고 열린 연결에 알린다. */
@Injectable()
export class CheckpointChatDraftUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_DRAFT_TOKEN) private readonly draftTokens: ChatDraftTokenPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_EXECUTION_UPDATE_PUBLISHER) private readonly events: ChatExecutionUpdatePublisherPort,
    ) {}

    async execute(input: ChatDraftCheckpointInput): Promise<{ readonly stored: boolean; readonly terminal: boolean }> {
        const execution = await this.executions.findById(input.executionId);
        // 토큰은 사용자 세션을 대신하지 않으므로 실행의 존재조차 자격이 맞을 때만 드러낸다.
        if (execution === null) throw new NotFoundException("Chat execution not found");
        if (!execution.acceptsDraftToken(this.draftTokens.hash(input.token))) {
            throw new ForbiddenException("Chat draft callback is not authorized");
        }
        // 재시도가 붙인 시도 번호를 실행기가 알 길이 없으므로, 살아 있는 시진행 중인 정본이 정한다.
        const stored = await this.executions.checkpointRunning(
            input.executionId,
            execution.attempt,
            input.text,
            input.draftSeq,
            this.clock.now(),
        );
        if (stored) this.events.publish(input.executionId);
        // 취소 레지스트리가 다른 인스턴스에 닿지 않으므로 이 응답이 종결을 대신 알린다.
        return { stored, terminal: execution.isTerminal() };
    }
}
