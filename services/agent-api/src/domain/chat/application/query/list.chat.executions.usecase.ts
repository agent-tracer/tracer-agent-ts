import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    mapExecution,
    type ChatConfirmationDto,
    type ChatExecutionDto,
} from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatPendingToolRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 스레드 하나의 실행 이력과 아직 승인을 기다리는 도구를 함께 준다. */
@Injectable()
export class ListChatExecutionsUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_EXECUTION_REPOSITORY)
        private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_PENDING_TOOL_REPOSITORY)
        private readonly pendingTools: ChatPendingToolRepositoryPort,
    ) {}

    async execute(userId: string, threadId: string): Promise<{
        readonly items: readonly ChatExecutionDto[];
        readonly confirmations: readonly ChatConfirmationDto[];
    }> {
        const thread = await this.threads.findById(threadId);
        if (thread === null || !thread.isOwnedBy(userId)) throw new NotFoundException("Thread not found");
        const [executions, pendingTools] = await Promise.all([
            this.executions.listByThread(threadId),
            this.pendingTools.listByThread(threadId),
        ]);
        return {
            items: executions.map(mapExecution),
            confirmations: pendingTools
                .filter((row) => row.isPending())
                .map((row) => ({ id: row.id, toolName: row.toolName, args: row.args })),
        };
    }
}
