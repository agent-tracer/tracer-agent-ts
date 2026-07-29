import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    CHAT_EXECUTION_DISPATCHER,
    type ChatExecutionDispatcherPort,
} from "~agent-api/domain/chat/port/chat.execution.dispatcher.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_TRANSACTION, type ChatTransactionPort } from "~agent-api/domain/chat/port/chat.transaction.port.js";

/** 소유한 대화 스레드를 그 메시지와 대기 도구까지 캐스케이드로 지운다. */
@Injectable()
export class DeleteThreadUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_EXECUTION_REPOSITORY)
        private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_EXECUTION_DISPATCHER)
        private readonly dispatcher: ChatExecutionDispatcherPort,
        @Inject(CHAT_TRANSACTION)
        private readonly transaction: ChatTransactionPort,
    ) {}

    async execute(userId: string, threadId: string): Promise<{ readonly deleted: true }> {
        const thread = await this.threads.findById(threadId);
        if (thread === null || !thread.isOwnedBy(userId)) throw new NotFoundException("Thread not found");

        const executions = await this.executions.listByThread(threadId);
        const active = executions.filter((execution) => !execution.isTerminal());
        await Promise.all(active.map((execution) => this.dispatcher.cancel(execution.id)));
        // 사용자 장기기억은 스레드가 아니라 사용자에 매인 것이라 여기서 지우지 않는다.
        await this.transaction.run(async (tx) => {
            await tx.chatExecutionSteps.deleteByExecutionIds(executions.map((execution) => execution.id));
            await tx.chatPendingTools.deleteByThread(threadId);
            await tx.chatMessages.deleteByThread(threadId);
            await tx.chatExecutions.deleteByThread(threadId);
            await tx.chatThreads.deleteById(threadId);
        });

        return { deleted: true };
    }
}
