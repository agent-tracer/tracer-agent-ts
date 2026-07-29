import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { mapExecution, type ChatExecutionDto } from "~agent-api/domain/chat/model/chat.model.js";
import {
    CHAT_EXECUTION_DISPATCHER,
    type ChatExecutionDispatcherPort,
} from "~agent-api/domain/chat/port/chat.execution.dispatcher.port.js";
import {
    CHAT_EXECUTION_UPDATE_PUBLISHER,
    type ChatExecutionUpdatePublisherPort,
} from "~agent-api/domain/chat/port/chat.execution.update.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

/** 실행 중인 대화 턴 하나를 중단하고 그 사실을 열린 연결에 알린다. */
@Injectable()
export class CancelChatExecutionUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY) private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_EXECUTION_DISPATCHER) private readonly dispatcher: ChatExecutionDispatcherPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
        @Inject(CHAT_EXECUTION_UPDATE_PUBLISHER) private readonly events: ChatExecutionUpdatePublisherPort,
    ) {}

    async execute(
        userId: string,
        threadId: string,
        executionId: string,
    ): Promise<{ readonly execution: ChatExecutionDto }> {
        const [thread, execution] = await Promise.all([
            this.threads.findById(threadId),
            this.executions.findById(executionId),
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
        await this.dispatcher.cancel(executionId);
        const changed = await this.executions.cancelActive(executionId, this.clock.now());
        if (changed) this.events.publish(executionId);
        const canceled = await this.executions.findById(executionId);
        if (canceled === null) throw new NotFoundException("Chat execution not found");
        return { execution: mapExecution(canceled) };
    }
}
