import type {
    ChatExecutionRepositoryPort,
    ChatExecutionStepRepositoryPort,
    ChatMessageRepositoryPort,
    ChatPendingToolRepositoryPort,
    ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

export const CHAT_TRANSACTION = Symbol("ChatTransaction");

/** 한 커밋 안에서만 유효한 저장소 묶음이다. */
export interface ChatTx {
    readonly chatExecutions: ChatExecutionRepositoryPort;
    readonly chatExecutionSteps: ChatExecutionStepRepositoryPort;
    readonly chatMessages: ChatMessageRepositoryPort;
    readonly chatPendingTools: ChatPendingToolRepositoryPort;
    readonly chatThreads: ChatThreadRepositoryPort;
}

export interface ChatTransactionPort {
    run<T>(work: (tx: ChatTx) => Promise<T>): Promise<T>;
}
