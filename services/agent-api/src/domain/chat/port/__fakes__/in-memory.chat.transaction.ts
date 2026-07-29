import type { ChatTransactionPort } from "~agent-api/domain/chat/port/chat.transaction.port.js";
import { InMemoryChatExecutionStepRepository } from "./in-memory.chat.execution.step.repository.js";
import type { InMemoryChatExecutionRepository } from "./in-memory.chat.execution.repository.js";
import type { InMemoryChatMessageRepository } from "./in-memory.chat.message.repository.js";
import type { InMemoryChatPendingToolRepository } from "./in-memory.chat.pending.tool.repository.js";
import type { InMemoryChatThreadRepository } from "./in-memory.chat.thread.repository.js";

export function inMemoryChatTransaction(repositories: {
    readonly executions: InMemoryChatExecutionRepository;
    readonly executionSteps?: InMemoryChatExecutionStepRepository;
    readonly messages: InMemoryChatMessageRepository;
    readonly pendingTools: InMemoryChatPendingToolRepository;
    readonly threads: InMemoryChatThreadRepository;
}): ChatTransactionPort {
    return {
        run: (work) => work({
            chatExecutions: repositories.executions,
            chatExecutionSteps: repositories.executionSteps ?? new InMemoryChatExecutionStepRepository(),
            chatMessages: repositories.messages,
            chatPendingTools: repositories.pendingTools,
            chatThreads: repositories.threads,
        }),
    };
}
