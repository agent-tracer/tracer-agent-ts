import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    mapExecution,
    type ChatConfirmationDto,
    type ChatExecutionDto,
} from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_EXECUTION_UPDATE_SUBSCRIBER,
    type ChatExecutionUpdateSubscriberPort,
} from "~agent-api/domain/chat/port/chat.execution.update.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatPendingToolRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 열린 연결이 한 번에 내보내는 실행 상태와 대기 도구다. */
export interface ChatExecutionSnapshot {
    readonly execution: ChatExecutionDto;
    readonly confirmations: readonly ChatConfirmationDto[];
}

@Injectable()
export class WatchChatExecutionUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_PENDING_TOOL_REPOSITORY) private readonly pendingTools: ChatPendingToolRepositoryPort,
        @Inject(CHAT_EXECUTION_UPDATE_SUBSCRIBER) private readonly events: ChatExecutionUpdateSubscriberPort,
    ) {}

    async snapshot(userId: string, threadId: string, executionId: string): Promise<ChatExecutionSnapshot> {
        const [thread, execution, pendingTools] = await Promise.all([
            this.threads.findById(threadId),
            this.executions.findById(executionId),
            this.pendingTools.listByThread(threadId),
        ]);
        if (
            thread === null ||
            !thread.isOwnedBy(userId) ||
            execution === null ||
            execution.threadId !== threadId ||
            execution.userId !== userId
        ) {
            throw new NotFoundException("Chat execution not found");
        }
        return {
            execution: mapExecution(execution),
            confirmations: pendingTools
                .filter((row) => row.isPending())
                .map((row) => ({ id: row.id, toolName: row.toolName, args: row.args })),
        };
    }

    subscribe(executionId: string, listener: () => void): () => void {
        return this.events.subscribe(executionId, listener);
    }
}
